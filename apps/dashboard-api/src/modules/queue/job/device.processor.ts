import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { DeviceService } from '../../devices/services/device.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { ActionType, StatusEnum, Credential, Device, Gate, Employee } from '@prisma/client';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';

@Processor(JOB.DEVICE.NAME, { concurrency: 5 })
export class DeviceProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
        private readonly hikvisionService: HikvisionAccessService,
        private readonly hikvisionAnprService: HikvisionAnprService,
        private readonly device: DeviceService,
        private readonly logger: LoggerService
    ) {
        super();
    }

    /**
     * Yangi qurilma yaratilganda sozlash (Event listenerlarni yoqish)
     */
    async createDevice(job: Job) {
        const { hikvisionConfig, newDevice, gateId, scope } = job.data;
        const deviceTypes = (newDevice?.type as ActionType[]) || [];

        try {
            await this.setupDeviceEvents(newDevice, hikvisionConfig, deviceTypes);
        } catch (err) {
            this.logger.error(`Device ${newDevice?.id} creation job failed: ${err.message}`);
        }
    }

    private async setupDeviceEvents(newDevice: any, hikvisionConfig: any, types: ActionType[]) {
        if (types.includes(ActionType.CAR)) {
            await this.hikvisionAnprService.configureAnprEventHost(hikvisionConfig, newDevice.id);
        }
        const accessTypes: ActionType[] = [
            ActionType.PHOTO,
            ActionType.CARD,
            ActionType.PERSONAL_CODE,
            ActionType.QR,
        ];
        if (types.some(t => accessTypes.includes(t))) {
            await this.hikvisionService.configureEventListeningHost(hikvisionConfig, newDevice.id);
        }
    }
    /** Xodimlarni qurilmalarga biriktirish va sinxronizatsiya */
    async assignEmployeesToDevicesJob(job: Job) {
        const { dto } = job.data;
        const { deviceIds, employeeIds, credentialTypes } = dto;

        const devices = await this.prisma.device.findMany({
            where: { id: { in: deviceIds }, isActive: true, deletedAt: null },
        });

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds }, isActive: true, deletedAt: null },
            include: {
                credentials: {
                    where: {
                        type: { in: credentialTypes as ActionType[] },
                        isActive: true,
                        deletedAt: null,
                    },
                },
            },
        });

        const empIds = employees.map(e => e.id);

        for (const device of devices) {
            await this.prisma.device.update({
                where: { id: device.id },
                data: {
                    employees: {
                        connect: empIds.map(id => ({ id })),
                    },
                },
            });
            const config = this.getDeviceConfig(device);

            for (const employee of employees) {
                for (const cred of employee.credentials) {
                    // Faqat qurilma turiga mos credentialni yuboramiz
                    if (device.type.includes(cred.type)) {
                        try {
                            await this.processCredentialSync(
                                employee,
                                cred,
                                device,
                                { id: device.gateId }, // Agar qurilma hali ham biron gatega tegishli bo'lsa
                                config,
                                undefined
                            );
                        } catch (err) {
                            this.logger.error(
                                `Sync error [Dev: ${device.id}, Emp: ${employee.id}]: ${err.message}`
                            );
                        }
                    }
                }
            }
        }
        return { success: true };
    }

    /** Xodimlarni qurilmalardan o'chirish */
    async removeEmployeesFromDevicesJob(job: Job) {
        const { dto } = job.data;
        const { deviceIds, employeeIds, credentialTypes } = dto;

        const devices = await this.prisma.device.findMany({
            where: { id: { in: deviceIds }, isActive: true, deletedAt: null },
        });

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds }, isActive: true, deletedAt: null },
            include: {
                credentials: {
                    where: {
                        type: { in: credentialTypes as ActionType[] },
                        deletedAt: null,
                        isActive: true,
                        employeeSync: { some: { status: StatusEnum.DONE } },
                    },
                },
            },
        });

        const empIds = employees.map(e => e.id);
        for (const device of devices) {
            await this.prisma.device.update({
                where: { id: device.id },
                data: {
                    employees: {
                        disconnect: empIds.map(id => ({ id })),
                    },
                },
            });

            const config = this.getDeviceConfig(device);

            for (const employee of employees) {
                try {
                    // Granular (nozik) o'chirish - faqat tanlangan turlarni
                    await this.processSpecificCredentialRemoval(
                        device,
                        config,
                        employee.id,
                        employee.credentials
                    );

                    // Sync jadvalidan o'chirilgan deb belgilash
                    await this.prisma.employeeSync.updateMany({
                        where: {
                            deviceId: device.id,
                            employeeId: employee.id,
                            credential: {
                                type: { in: credentialTypes },
                                deletedAt: null,
                                isActive: true,
                            },
                            deletedAt: null,
                        },
                        data: { deletedAt: new Date() },
                    });
                } catch (err) {
                    this.logger.error(
                        `Remove error [Dev: ${device.id}, Emp: ${employee.id}]: ${err.message}`
                    );
                }
            }
        }
        return { success: true };
    }

    private async processCredentialSync(
        employee: Pick<Employee, 'id' | 'organizationId'>,
        cred: Credential,
        device: Device,
        gate: { id: number },
        config: HikvisionConfig,
        oldCode?: string,
        isUpdate: boolean = false
    ) {
        let sync = await this.prisma.employeeSync.findFirst({
            where: {
                gateId: gate.id,
                deviceId: device.id,
                employeeId: employee.id,
                credentialId: cred.id,
                deletedAt: null,
            },
        });

        if (sync?.status === StatusEnum.DONE && !isUpdate) return;

        if (!sync) {
            sync = await this.prisma.employeeSync.create({
                data: {
                    gateId: gate.id,
                    deviceId: device.id,
                    employeeId: employee.id,
                    credentialId: cred.id,
                    organizationId: employee.organizationId,
                    status: StatusEnum.WAITING,
                },
            });
        }

        try {
            switch (cred.type) {
                case ActionType.CAR:
                    if (!cred.code) throw new Error('Car plate empty');
                    // Agar eski kod bo'lsa va u yangisidan farq qilsa -> EDIT
                    if (oldCode && oldCode !== cred.code) {
                        await this.hikvisionAnprService.editLicensePlate(
                            oldCode,
                            cred.code,
                            '1',
                            config
                        );
                    } else {
                        await this.syncCarToDevice([cred.code], config);
                    }
                    break;

                case ActionType.PHOTO:
                    if (!cred.additionalDetails) throw new Error('Photo URL missing');
                    await this.syncFaceToDevice(
                        employee.id.toString(),
                        cred.additionalDetails,
                        config
                    );
                    break;

                case ActionType.QR:
                case ActionType.CARD:
                    if (!cred.code) throw new Error('Card code empty');
                    // Agar eski karta bo'lsa -> REPLACE
                    if (oldCode && oldCode !== cred.code) {
                        await this.hikvisionService.replaceCard(
                            oldCode,
                            cred.code,
                            String(employee.id),
                            config
                        );
                    } else {
                        await this.syncCardToDevice(employee.id.toString(), cred.code, config);
                    }
                    break;

                case ActionType.PERSONAL_CODE:
                    if (!cred.code) throw new Error('Password empty');
                    await this.syncPasswordToDevice(employee.id.toString(), cred.code, config);
                    break;
            }

            await this.updateSync(
                sync.id,
                StatusEnum.DONE,
                isUpdate ? 'Successfully updated' : 'Successfully synced'
            );
        } catch (err: any) {
            await this.updateSync(sync.id, StatusEnum.FAILED, err.message);
            this.logger.error(err.message, '', 'DeviceProcessor'); // Yuqoriga catch qilish uchun
        }
    }

    async clearDeviceUsersJob(job: Job) {
        const { deviceId } = job.data;

        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            this.logger.warn(`Device ${deviceId} not found`, 'DeviceJob');
            return;
        }

        const config = this.getDeviceConfig(device);

        this.logger.log(
            `Starting CLEAR job for Device ${device.id} (type: ${device.type})`,
            'DeviceJob'
        );

        if (device.type.includes(ActionType.CAR)) {
            await this.clearAnprDevice(device, config);
        }

        const types = device.type || [];

        const accessTypes: ActionType[] = [
            ActionType.PHOTO,
            ActionType.CARD,
            ActionType.PERSONAL_CODE,
            ActionType.QR,
        ];
        const isAccess = types.some(t => accessTypes.includes(t));
        if (isAccess) {
            await this.clearAccessDevice(device, config);
        }
    }

    private async clearAnprDevice(device: any, config: HikvisionConfig) {
        this.logger.log(`Clearing ANPR license plates for Device ${device.id}`, 'DeviceJob');

        // 1️⃣ BARCHA PLATELARNI OLAMIZ
        const plates = await this.hikvisionAnprService.searchLicensePlates(config);

        if (!plates.length) {
            this.logger.log(`No license plates found on ANPR device ${device.id}`, 'DeviceJob');
            return;
        }

        this.logger.log(
            `Found ${plates.length} license plates on ANPR device ${device.id}`,
            'DeviceJob'
        );

        for (const plate of plates) {
            const plateNo = plate.LicensePlate || plate.licensePlate;
            if (!plateNo) continue;

            try {
                await this.hikvisionAnprService.deleteLicensePlate(plateNo, config);
                const cred = await this.prisma.credential.findFirst({
                    where: { type: ActionType.CAR, code: plateNo, deletedAt: null },
                });
                // DB SYNC NI YOPAMIZ
                await this.prisma.employeeSync.updateMany({
                    where: {
                        deviceId: device.id,
                        credentialId: cred?.id,
                        employeeId: cred ? cred.employeeId : undefined,
                        deletedAt: null,
                    },
                    data: { deletedAt: new Date() },
                });
            } catch (err) {
                this.logger.error(
                    ` Failed to delete plate ${plateNo}: ${err.message}`,
                    'DeviceJob'
                );
            }
        }

        this.logger.log(`ANPR device ${device.id} cleanup completed`, 'DeviceJob');
    }

    private async clearAccessDevice(device: any, config: HikvisionConfig) {
        const users = await this.hikvisionService.getAllUsers(config);

        if (!users.length) {
            this.logger.log(`No users found on device ${device.id}`, 'DeviceJob');
            return;
        }

        for (const user of users) {
            try {
                await this.hikvisionService.deleteUser(user.employeeNo, config);

                await this.prisma.employeeSync.updateMany({
                    where: {
                        deviceId: device.id,
                        employeeId: Number(user.employeeNo),
                        deletedAt: null,
                    },
                    data: { deletedAt: new Date() },
                });
            } catch (err) {
                this.logger.error(
                    `❌ Failed to delete user ${user.employeeNo}: ${err.message}`,
                    'DeviceJob'
                );
            }
        }

        this.logger.log(`🏁 Access device ${device.id} cleanup completed`, 'DeviceJob');
    }

    // --- Sinxronizatsiya yordamchilari ---
    private async syncFaceToDevice(employeeId: string, photoUrl: string, config: HikvisionConfig) {
        await this.hikvisionService.createUser(+employeeId, config);
        await this.hikvisionService.addFaceToUserViaURL(employeeId, photoUrl, config);
    }

    private async syncCarToDevice(carNumbers: string[], config: HikvisionConfig) {
        for (const plate of carNumbers) {
            await this.hikvisionAnprService.addLicensePlate(plate, '1', config);
        }
    }

    private async syncPasswordToDevice(employeeId: string, code: string, config: HikvisionConfig) {
        await this.hikvisionService.createUser(+employeeId, config);
        await this.hikvisionService.addPasswordToUser(employeeId, code, config);
    }

    private async syncCardToDevice(employeeId: string, cardNo: string, config: HikvisionConfig) {
        await this.hikvisionService.createUser(+employeeId, config);
        await this.hikvisionService.addCardToUser({ employeeNo: employeeId, cardNo, config });
    }

    private getDeviceConfig(device: Device): HikvisionConfig {
        return {
            host: device.ipAddress || '',
            port: 80,
            protocol: 'http',
            username: device.login || '',
            password: device.password || '',
        };
    }

    private async updateSync(id: number, status: StatusEnum, message?: string) {
        await this.prisma.employeeSync.update({
            where: { id },
            data: { status, message, updatedAt: new Date() },
        });
    }

    async removeSpecificCredentialsJob(job: Job) {
        const { gateId, employeeId, credentialIds } = job.data;

        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: true },
        });

        const credentials = await this.prisma.credential.findMany({
            where: { id: { in: credentialIds } },
        });

        if (!gate?.devices?.length || !credentials.length) return;

        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);

            // Yangi granular metodni chaqiramiz
            await this.processSpecificCredentialRemoval(device, config, employeeId, credentials);

            // Faqat o'chirilgan credentiallar uchun Sync statusini yangilaymiz
            await this.prisma.employeeSync.updateMany({
                where: {
                    gateId,
                    deviceId: device.id,
                    employeeId: employeeId,
                    credentialId: { in: credentialIds },
                    deletedAt: null,
                },
                data: { deletedAt: new Date() },
            });
        }
    }

    /**
     * Qurilmadan FAQAT ma'lum bir credentiallarni o'chirish (User o'chmaydi)
     */
    private async processSpecificCredentialRemoval(
        device: Device,
        config: HikvisionConfig,
        employeeId: number,
        credentials: Credential[]
    ) {
        for (const cred of credentials) {
            try {
                switch (cred.type) {
                    case ActionType.CAR:
                        if (cred.code && device.type.includes(ActionType.CAR)) {
                            await this.hikvisionAnprService.deleteLicensePlate(cred.code, config);
                        }
                        break;

                    case ActionType.CARD:
                    case ActionType.QR:
                        if (
                            cred.code &&
                            (device.type.includes(ActionType.CARD) ||
                                device.type.includes(ActionType.QR))
                        ) {
                            await this.hikvisionService.deleteCard({
                                employeeNo: String(employeeId),
                                cardNo: cred.code,
                                config,
                            });
                        }
                        break;

                    case ActionType.PHOTO:
                        // HikvisionService'dagi deleteFaceFromUser foydalanuvchini o'chirmaydi, faqat rasmini o'chiradi
                        if (device.type.includes(ActionType.PHOTO)) {
                            await this.hikvisionService.deleteFaceFromUser(
                                String(employeeId),
                                config
                            );
                        }
                        break;

                    case ActionType.PERSONAL_CODE:
                        // Parolni bo'shatish orqali o'chirish
                        if (device.type.includes(ActionType.PERSONAL_CODE)) {
                            await this.hikvisionService.addPasswordToUser(
                                String(employeeId),
                                '',
                                config
                            );
                        }
                        break;
                }
            } catch (err) {
                this.logger.error(
                    `Granular removal failed [Type: ${cred.type}, ID: ${cred.id}] from Device ${device.id}: ${err.message}`
                );
            }
        }
    }

    async syncCredentialsToDevicesJob(job: Job) {
        const { gateId, employeeId, credentialIds, oldCode } = job.data;

        // 1. Gate va qurilmalarni olamiz
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: { where: { isActive: true, deletedAt: null } } },
        });

        if (!gate?.devices?.length) return;

        // 2. Xodim va aynan so'ralgan credentiallarni olamiz
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: {
                credentials: {
                    where: { id: { in: credentialIds }, isActive: true, deletedAt: null },
                },
            },
        });

        if (!employee || !employee.credentials.length) return;

        // 3. Har bir qurilmaga faqat uning turiga mos credentiallarni yuboramiz
        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            for (const cred of employee.credentials) {
                if (device.type.includes(cred.type)) {
                    try {
                        // Mavjud processCredentialSync funksiyasini ishlatamiz
                        // U EmployeeSync jadvalini o'zi tekshiradi va yaratadi
                        await this.processCredentialSync(
                            employee,
                            cred,
                            device,
                            gate,
                            config,
                            oldCode
                        );
                    } catch (err) {
                        this.logger.error(
                            `Sync failed [Dev: ${device.id}, Cred: ${cred.id}]: ${err.message}`
                        );
                    }
                }
            }
        }
    }

    async process(job: Job<any, any, string>) {
        switch (job.name) {
            case JOB.DEVICE.DEVICE_SYNC_EMPLOYEES: // Constants-ga qo'shing
                return this.assignEmployeesToDevicesJob(job);

            case JOB.DEVICE.DEVICE_REMOVE_EMPLOYEES: // Constants-ga qo'shing
                return this.removeEmployeesFromDevicesJob(job);

            case JOB.DEVICE.CREATE:
                return this.createDevice(job);

            case JOB.DEVICE.DELETE:
                return this.clearDeviceUsersJob(job);

            case JOB.DEVICE.REMOVE_SPECIFIC_CREDENTIALS:
                return this.removeSpecificCredentialsJob(job);

            case JOB.DEVICE.SYNC_CREDENTIALS_TO_DEVICES: // <-- YANGI CASE
                return this.syncCredentialsToDevicesJob(job);

            // case JOB.DEVICE.CLEAR_ALL_USERS_FROM_DEVICE: // Shared constants-ga qo'shib qo'ying
            //     return this.clearDeviceUsersJob(job);

            // case JOB.DEVICE.REMOVE_EMPLOYEES:
            //     const { employeeIds: ids } = job.data;
            //     const syncRecords = await this.prisma.employeeSync.findMany({
            //         where: { employeeId: { in: ids }, deletedAt: null },
            //         include: { device: true, employee: { include: { credentials: true } } },
            //     });
            //     for (const record of syncRecords) {
            //         try {
            //             await this.processRemovalFromDevice(
            //                 record.device,
            //                 this.getDeviceConfig(record.device),
            //                 record.employeeId,
            //                 record.employee.credentials
            //             );
            //             await this.prisma.employeeSync.update({
            //                 where: { id: record.id },
            //                 data: { deletedAt: new Date() },
            //             });
            //         } catch (err) {}
            //     }
            //     return;
        }
    }
}
