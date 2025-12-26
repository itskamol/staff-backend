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

            const activeSyncs = await this.prisma.employeeSync.findMany({
                where: {
                    gateId: gateId,
                    deletedAt: null,
                    credential: {
                        type: { in: deviceTypes },
                    },
                },
                select: {
                    employeeId: true,
                    credentialId: true,
                },
                distinct: ['employeeId', 'credentialId'],
            });

            if (activeSyncs.length === 0) {
                this.logger.log(
                    `No authorized credentials found for gate ${gateId} to sync with new device ${newDevice.id}`
                );
                return;
            }

            for (const sync of activeSyncs) {
                const employee = await this.prisma.employee.findUnique({
                    where: { id: sync.employeeId },
                    include: { credentials: { where: { id: sync.credentialId } } },
                });

                if (employee && employee.credentials.length > 0) {
                    // Bu metod ichida EmployeeSync statusi tekshiriladi va qurilmaga yuboriladi
                    await this.processCredentialSync(
                        employee,
                        employee.credentials[0],
                        newDevice,
                        { id: gateId },
                        hikvisionConfig
                    );
                }
            }

            this.logger.log(
                `Device ${newDevice?.id} initial sync completed selectively`,
                'DeviceJob'
            );
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

    /**
     * Xodimlarni darvozaga biriktirish va sinxronizatsiya
     */
    async assignEmployeesToGatesJob(job: Job) {
        const { dto } = job.data;
        const { gateId, employeeIds, credentialTypes } = dto;

        if (!gateId || !employeeIds?.length) return;

        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: { where: { isActive: true, deletedAt: null } } },
        });
        if (!gate || !gate.devices.length) return;

        const { connected, disconnected } = await this.updateGateEmployees(gate.id, employeeIds);

        if (disconnected.length > 0) {
            await this.removeGateEmployeesToDevices(gate.id, disconnected);
        }

        if (connected.length === 0) return { success: true, message: 'No new employees to sync' };

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: connected } },
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

        if (!gate.devices?.length || !credentialTypes.length) return;

        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            for (const employee of employees) {
                for (const cred of employee.credentials) {
                    if (device.type.includes(cred.type)) {
                        await this.processCredentialSync(employee, cred, device, gate, config);
                    }
                }
            }
        }
        return { success: true };
    }

    /**
     * Qurilmadan xodimni o'chirish logikasi (FAQAT type massivi orqali)
     */
    private async processRemovalFromDevice(
        device: Device,
        config: HikvisionConfig,
        employeeId: number,
        credentials: Credential[]
    ) {
        const types = device.type || [];

        // 1. ANPR mantiqi
        const isAnpr = types.includes(ActionType.CAR);
        if (isAnpr) {
            const carCreds = credentials.filter(c => c.type === ActionType.CAR);
            for (const cred of carCreds) {
                if (cred.code)
                    await this.hikvisionAnprService.deleteLicensePlate(cred.code, config);
            }
        }

        // 2. Access mantiqi
        const accessTypes: ActionType[] = [
            ActionType.PHOTO,
            ActionType.CARD,
            ActionType.PERSONAL_CODE,
            ActionType.QR,
        ];
        const isAccess = types.some(t => accessTypes.includes(t));
        if (isAccess) {
            await this.hikvisionService.deleteUser(String(employeeId), config);
        }
    }

    /**
     * Darvozadan uzilgan xodimlarni qurilmalardan tozalash
     */
    async removeGateEmployeesToDevices(gateId: number, employeeIds: number[]) {
        const gate = await this.prisma.gate.findFirst({
            where: { id: gateId },
            include: { devices: true },
        });

        if (!gate?.devices?.length) return;

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            include: { credentials: { where: { isActive: true } } },
        });

        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            for (const emp of employees) {
                try {
                    await this.processRemovalFromDevice(device, config, emp.id, emp.credentials);
                    await this.prisma.employeeSync.updateMany({
                        where: { gateId, deviceId: device.id, employeeId: emp.id, deletedAt: null },
                        data: { deletedAt: new Date() },
                    });
                } catch (err) {
                    this.logger.error(
                        `Removal failed [Dev: ${device.id}, Emp: ${emp.id}]: ${err.message}`
                    );
                }
            }
        }
    }

    private async processCredentialSync(
        employee: Pick<Employee, 'id' | 'organizationId'>,
        cred: Credential,
        device: Device,
        gate: { id: number },
        config: HikvisionConfig,
        oldCode?: string // Tahrirlash uchun eski kod
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

        if (sync?.status === StatusEnum.DONE) return;

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

        // QR kodni CARD sifatida yuborish logikasi
        const effectiveType = cred.type === ActionType.QR ? ActionType.CARD : cred.type;

        try {
            switch (effectiveType) {
                case ActionType.CAR:
                    if (!cred.code) throw new Error('Car plate empty');
                    // Agar oldCode bo'lsa edit, bo'lmasa add
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

                case ActionType.CARD:
                    if (!cred.code) throw new Error('Card code empty');
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

            await this.updateSync(sync.id, StatusEnum.DONE, 'Success');
        } catch (err: any) {
            await this.updateSync(sync.id, StatusEnum.FAILED, err.message);
            this.logger.error(err.message, '', 'DeviceProcessor'); // Yuqoriga catch qilish uchun
        }
    }

    async clearDeviceUsersJob(job: Job) {
        const { deviceId } = job.data;

        // 1. Qurilmani va unga bog'langan barcha faol sync rekordlarini olamiz
        const device = await this.prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) return;

        const syncRecords = await this.prisma.employeeSync.findMany({
            where: {
                deviceId: device.id,
                deletedAt: null,
            },
            include: {
                employee: {
                    include: {
                        credentials: { where: { isActive: true } },
                    },
                },
            },
        });

        if (syncRecords.length === 0) {
            this.logger.log(`Device ${deviceId} has no users to clear`, 'DeviceJob');
            return;
        }

        const config = this.getDeviceConfig(device);
        this.logger.log(
            `Starting full clear for Device ${device.id} (${syncRecords.length} users)`,
            'DeviceJob'
        );

        // 2. Har bir xodimni qurilmadan o'chiramiz
        for (const record of syncRecords) {
            try {
                // Avval hardware-dan o'chiramiz
                await this.processRemovalFromDevice(
                    device,
                    config,
                    record.employeeId,
                    record.employee.credentials
                );

                // Keyin bazada o'chirilgan deb belgilaymiz
                await this.prisma.employeeSync.update({
                    where: { id: record.id },
                    data: { deletedAt: new Date() },
                });
            } catch (err) {
                this.logger.error(
                    `Failed to clear user ${record.employeeId} from Device ${device.id}: ${err.message}`,
                    null,
                    'DeviceJob'
                );
            }
        }

        this.logger.log(`Device ${device.id} cleanup completed`, 'DeviceJob');
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

    private async updateGateEmployees(gateId: number, newEmployeeIds: number[]) {
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            select: { employees: { select: { id: true } } },
        });
        const oldIds = gate?.employees.map(e => e.id) || [];
        const toConnect = newEmployeeIds.filter(id => !oldIds.includes(id));
        const toDisconnect = oldIds.filter(id => !newEmployeeIds.includes(id));

        await this.prisma.gate.update({
            where: { id: gateId },
            data: {
                employees: {
                    connect: toConnect.map(id => ({ id })),
                    disconnect: toDisconnect.map(id => ({ id })),
                },
            },
        });
        return { connected: toConnect, disconnected: toDisconnect };
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
                        if (cred.code) {
                            await this.hikvisionAnprService.deleteLicensePlate(cred.code, config);
                        }
                        break;

                    case ActionType.CARD:
                    case ActionType.QR:
                        if (cred.code) {
                            await this.hikvisionService.deleteCard({
                                employeeNo: String(employeeId),
                                cardNo: cred.code,
                                config,
                            });
                        }
                        break;

                    case ActionType.PHOTO:
                        // HikvisionService'dagi deleteFaceFromUser foydalanuvchini o'chirmaydi, faqat rasmini o'chiradi
                        await this.hikvisionService.deleteFaceFromUser(String(employeeId), config);
                        break;

                    case ActionType.PERSONAL_CODE:
                        // Parolni bo'shatish orqali o'chirish
                        await this.hikvisionService.addPasswordToUser(
                            String(employeeId),
                            '',
                            config
                        );
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
        const { gateId, employeeId, credentialIds } = job.data;

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
                        await this.processCredentialSync(employee, cred, device, gate, config);
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
            case JOB.DEVICE.CREATE:
                return this.createDevice(job);

            case JOB.DEVICE.DELETE:
                return this.clearDeviceUsersJob(job);

            case JOB.DEVICE.ASSIGN_EMPLOYEES_TO_GATES:
                return this.assignEmployeesToGatesJob(job);

            case JOB.DEVICE.REMOVE_SPECIFIC_CREDENTIALS:
                return this.removeSpecificCredentialsJob(job);

            case JOB.DEVICE.SYNC_CREDENTIALS_TO_DEVICES: // <-- YANGI CASE
                return this.syncCredentialsToDevicesJob(job);

            case JOB.DEVICE.REMOVE_GATE_EMPLOYEE_DATA:
                const { gateId, employeeIds } = job.data;
                return this.removeGateEmployeesToDevices(gateId, employeeIds);

            case JOB.DEVICE.CLEAR_ALL_USERS_FROM_DEVICE: // Shared constants-ga qo'shib qo'ying
                return this.clearDeviceUsersJob(job);

            case JOB.DEVICE.REMOVE_EMPLOYEES:
                const { employeeIds: ids } = job.data;
                const syncRecords = await this.prisma.employeeSync.findMany({
                    where: { employeeId: { in: ids }, deletedAt: null },
                    include: { device: true, employee: { include: { credentials: true } } },
                });
                for (const record of syncRecords) {
                    try {
                        await this.processRemovalFromDevice(
                            record.device,
                            this.getDeviceConfig(record.device),
                            record.employeeId,
                            record.employee.credentials
                        );
                        await this.prisma.employeeSync.update({
                            where: { id: record.id },
                            data: { deletedAt: new Date() },
                        });
                    } catch (err) {}
                }
                return;
        }
    }
}
