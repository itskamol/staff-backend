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
        const types = (newDevice?.type as ActionType[]) || [];

        try {
            // 1. ANPR sozlash
            if (types.includes(ActionType.CAR)) {
                await this.hikvisionAnprService.configureAnprEventHost(
                    hikvisionConfig,
                    newDevice.id
                );
            }

            // 2. Access sozlash (PHOTO, CARD, QR, PERSONAL_CODE turlaridan biri bo'lsa)
            const accessTypes: ActionType[] = [
                ActionType.PHOTO,
                ActionType.CARD,
                ActionType.PERSONAL_CODE,
                ActionType.QR,
            ];
            const isAccessDevice = types.some(t => accessTypes.includes(t));

            if (isAccessDevice) {
                await this.hikvisionService.configureEventListeningHost(
                    hikvisionConfig,
                    newDevice.id
                );
            }

            // 3. Xodimlarni biriktirish
            const gate = await this.prisma.gate.findFirstOrThrow({
                where: { id: gateId },
                select: { employees: { select: { id: true } } },
            });

            await this.device.assignEmployeesToGates(
                {
                    gateId,
                    employeeIds: gate.employees.map(e => e.id),
                    credentialTypes: types,
                },
                scope
            );

            this.logger.log(`Device ${newDevice?.id} background tasks completed`, 'DeviceJob');
        } catch (err) {
            this.logger.error(
                `Device ${newDevice?.id} create job failed: ${err.message}`,
                null,
                'DeviceJob'
            );
        }
    }

    /**
     * Xodimlarni darvozaga biriktirish va sinxronizatsiya
     */
    async assignEmployeesToGatesJob(job: Job) {
        const { dto } = job.data;
        const { gateId, employeeIds, credentialTypes } = dto;

        if (!gateId || !employeeIds?.length) return;

        const [gate, employees] = await Promise.all([
            this.prisma.gate.findUnique({
                where: { id: gateId },
                include: { devices: { where: { isActive: true, deletedAt: null } } },
            }),
            this.prisma.employee.findMany({
                where: { id: { in: employeeIds } },
                include: {
                    credentials: {
                        where: {
                            type: { in: credentialTypes as ActionType[] },
                            isActive: true,
                            deletedAt: null,
                        },
                    },
                },
            }),
        ]);

        if (!gate) return;

        // Gate-Employee munosabatini yangilash
        const syncResult = await this.updateGateEmployees(gate.id, employeeIds);

        // Darvozadan uzilganlarni o'chirish
        if (syncResult.disconnected.length > 0) {
            await this.removeGateEmployeesToDevices(gate.id, syncResult.disconnected);
        }

        if (!gate.devices?.length) return;
        if (!credentialTypes.length) return;

        // Har bir qurilma uchun sinxronizatsiya
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

    async syncSingleCredentialJob(job: Job) {
        const { employeeId, credentialId, action, oldCode } = job.data;

        const [employee, credential] = await Promise.all([
            this.prisma.employee.findUnique({
                where: { id: employeeId },
                include: {
                    gates: { include: { devices: { where: { isActive: true, deletedAt: null } } } },
                },
            }),
            this.prisma.credential.findUnique({ where: { id: credentialId } }),
        ]);

        if (!employee || !credential) return;

        // Qurilmalarni filtrlaymiz (faqat mos turlari borlarini)
        const devices = employee.gates.flatMap(gate =>
            gate.devices.filter(device => device.type.includes(credential.type))
        );

        for (const device of devices) {
            const config = this.getDeviceConfig(device);
            try {
                if (action === 'Delete') {
                    await this.processRemovalFromDevice(device, config, employee.id, [credential]);

                    await this.prisma.employeeSync.updateMany({
                        where: {
                            deviceId: device.id,
                            credentialId: credential.id,
                            deletedAt: null,
                        },
                        data: { deletedAt: new Date() },
                    });
                } else {
                    // Create yoki Edit (processCredentialSync ichida handle qilamiz)
                    await this.processCredentialSync(
                        employee,
                        credential,
                        device,
                        { id: device.gateId } as any,
                        config,
                        oldCode
                    );
                }
            } catch (err) {
                this.logger.error(
                    `Sync error [Dev: ${device.id}, Cred: ${credential.id}]: ${err.message}`
                );
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

            case JOB.DEVICE.REMOVE_GATE_EMPLOYEE_DATA:
                const { gateId, employeeIds } = job.data;
                return this.removeGateEmployeesToDevices(gateId, employeeIds);

            case JOB.DEVICE.CLEAR_ALL_USERS_FROM_DEVICE: // Shared constants-ga qo'shib qo'ying
                return this.clearDeviceUsersJob(job);

            case JOB.DEVICE.SYNC_SINGLE_CREDENTIAL:
                return this.syncSingleCredentialJob(job);

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
