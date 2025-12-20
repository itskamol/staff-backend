import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { DeviceService } from '../../devices/services/device.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { ActionType, DeviceType, StatusEnum } from '@prisma/client';
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

    async createDevice(job: Job) {
        const { hikvisionConfig, newDevice, gateId, scope } = job.data;

        try {
            if (newDevice?.type === DeviceType.CAR) {
                await this.hikvisionAnprService.configureAnprEventHost(
                    hikvisionConfig,
                    newDevice?.id
                );
            }
            if (
                newDevice?.type === DeviceType.ACCESS_CONTROL ||
                newDevice?.type === DeviceType.FACE
            ) {
                await this.hikvisionService.configureEventListeningHost(
                    hikvisionConfig,
                    newDevice?.id
                );
            }

            const gate = await this.prisma.gate.findFirstOrThrow({
                where: { id: gateId },
                select: { employees: { select: { id: true } } },
            });
            const employeeIds = gate?.employees?.map(e => e.id);

            await this.device.assignEmployeesToGates({ gateIds: [gateId], employeeIds }, scope);
            this.logger.log(`Device ${newDevice?.id} background tasks completed`, 'DeviceJob');
        } catch (err) {
            this.logger.error(
                `Device ${newDevice?.id} background job failed:`,
                err.message,
                'DeviceJob'
            );
        }
    }

    async removeGateEmployees(job: Job) {
        const { gateId, employeeIds } = job.data;
        return this.removeGateEmployeesToDevices(gateId, employeeIds);
    }

    async removeGateEmployeesToDevices(gateId: number, employeeIds: number[]) {
        // 1. Gate va Devices ni olamiz
        const gate = await this.prisma.gate.findFirstOrThrow({
            where: { id: gateId },
            select: {
                id: true,
                devices: {
                    select: {
                        id: true,
                        ipAddress: true,
                        login: true,
                        password: true,
                        type: true,
                        capabilities: true,
                    },
                },
            },
        });

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: {
                id: true,
                credentials: {
                    where: { isActive: true },
                    select: { type: true, code: true },
                },
            },
        });

        for (const device of gate.devices) {
            const config: HikvisionConfig = {
                host: device.ipAddress,
                port: 80,
                username: device.login,
                password: device.password,
                protocol: 'http',
            };

            for (const emp of employees) {
                try {
                    // 1. Qurilmadan o'chiramiz (Helper orqali)
                    await this.processRemovalFromDevice(device, config, emp.id, emp.credentials);

                    // 2. AGAR MUVAFFAQIYATLI BO'LSA -> Bazadan sync ni o'chiramiz (Soft delete)
                    await this.prisma.employeeSync.updateMany({
                        where: {
                            employeeId: emp.id,
                            deviceId: device.id,
                            gateId: gate.id,
                            deletedAt: null,
                        },
                        data: { deletedAt: new Date() },
                    });

                    this.logger.log(
                        `[DeviceJob] Removed employee ${emp.id} from Device ${device.id}`
                    );
                } catch (err) {
                    this.logger.warn(
                        `[DeviceJob] Failed to remove employee ${emp.id} from device ${device.id}: ${err.message}`
                    );
                }
            }
        }
    }

    async removeDeviceUsers(job: Job) {
        const { device, config } = job.data;
        try {
            const gate = await this.prisma.gate.findFirstOrThrow({
                where: { id: device.gateId },
                select: {
                    id: true,
                    employees: {
                        select: {
                            id: true,
                            credentials: {
                                where: { isActive: true },
                                select: { code: true, type: true },
                            },
                        },
                    },
                },
            });

            for (const e of gate.employees) {
                try {
                    await this.processRemovalFromDevice(device, config, e.id, e.credentials);

                    await this.prisma.employeeSync.updateMany({
                        where: {
                            employeeId: e.id,
                            deviceId: device.id,
                            gateId: gate.id,
                            deletedAt: null,
                        },
                        data: { deletedAt: new Date() },
                    });
                } catch (err) {
                    this.logger.warn(`Employee ${e.id} not deleted: ${err.message}`, 'DeviceJob');
                }
            }

            this.logger.log(`Device ${device.id} users deleted`, 'DeviceJob');
        } catch (err) {
            this.logger.error(`removeDeviceUsers failed:`, err.message, 'DeviceJob');
        }
    }

    async removeEmployeesFromDevices(job: Job) {
        const { employeeIds } = job.data;

        if (!employeeIds || employeeIds.length === 0) return;

        this.logger.log(`Deleting ${employeeIds.length} employees from devices...`, 'DeviceJob');

        try {
            const syncRecords = await this.prisma.employeeSync.findMany({
                where: {
                    employeeId: { in: employeeIds },
                    status: StatusEnum.DONE,
                    deletedAt: null,
                },
                include: {
                    device: true,
                    employee: {
                        select: {
                            id: true,
                            credentials: {
                                where: { isActive: true },
                                select: { type: true, code: true },
                            },
                        },
                    },
                },
            });

            if (syncRecords.length === 0) return;

            for (const record of syncRecords) {
                const { device, employee } = record;
                if (!device || !employee) continue;

                const config: HikvisionConfig = {
                    host: device.ipAddress,
                    port: 80,
                    username: device.login,
                    password: device.password,
                    protocol: 'http',
                };

                try {
                    await this.processRemovalFromDevice(
                        device,
                        config,
                        employee.id,
                        employee.credentials
                    );

                    // ✅ Muvaffaqiyatli bo'lsa, Sync yozuvini o'chiramiz
                    await this.prisma.employeeSync.update({
                        where: { id: record.id },
                        data: {
                            deletedAt: new Date(),
                        },
                    });
                } catch (err) {
                    this.logger.warn(
                        `Failed to delete employee ${employee.id} from device ${device.id}: ${err.message}`,
                        'DeviceJob'
                    );
                }
            }

            this.logger.log(`Cleanup job finished`, 'DeviceJob');
        } catch (err) {
            this.logger.error(`removeEmployeesFromDevices Job Failed:`, err.message, 'DeviceJob');
            throw err;
        }
    }

    private async processRemovalFromDevice(
        device: any,
        config: HikvisionConfig,
        employeeId: number,
        credentials: { type: string; code: string }[]
    ) {
        const caps = (device.capabilities as any) || {};
        const isAnpr = device.type === DeviceType.CAR || caps.isSupportAnpr;
        const isAccess =
            device.type === DeviceType.ACCESS_CONTROL ||
            device.type === DeviceType.FACE ||
            caps.isSupportFace;

        if (isAnpr && credentials?.length) {
            const carCreds = credentials.filter(c => c.type === ActionType.CAR);

            for (const cred of carCreds) {
                if (cred.code) {
                    await this.hikvisionAnprService.deleteLicensePlate(cred.code, config);
                    this.logger.log(
                        `Deleted plate ${cred.code} from Device ${device.id}`,
                        'DeviceJob'
                    );
                }
            }
        }

        if (isAccess) {
            await this.hikvisionService.deleteUser(String(employeeId), config);
            this.logger.log(`Deleted user ${employeeId} from Device ${device.id}`, 'DeviceJob');
        }
    }

    async assignEmployeesToGatesJob(job: Job) {
        const { scope, dto } = job.data;
        const { gateIds, employeeIds } = dto;

        if (!gateIds?.length || !employeeIds?.length) return;

        const gates = await this.prisma.gate.findMany({
            where: { id: { in: gateIds } },
            include: { devices: true },
        });

        if (!gates.length) return;

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: { id: true, name: true, photo: true, organizationId: true },
        });

        if (!employees.length) return;
        const employeeMap = new Map(employees.map(e => [e.id, e]));

        const credentials = await this.prisma.credential.findMany({
            where: {
                employeeId: { in: employeeIds },
                isActive: true,
                deletedAt: null,
            },
            select: { id: true, employeeId: true, type: true, code: true, additionalDetails: true },
        });

        const employeeCredsMap = new Map<number, typeof credentials>();
        credentials.forEach(cred => {
            const list = employeeCredsMap.get(cred.employeeId) || [];
            list.push(cred);
            employeeCredsMap.set(cred.employeeId, list);
        });

        for (const gate of gates) {
            const syncEmployees = await this.updateGateEmployees(gate.id, employeeIds);
            if (syncEmployees.disconnected.length > 0) {
                await this.removeGateEmployeesToDevices(gate.id, syncEmployees.disconnected);
            }

            if (!gate.devices?.length) continue;

            for (const device of gate.devices) {
                const caps = (device.capabilities as any) || {};
                const config: HikvisionConfig = {
                    host: device.ipAddress,
                    port: 80,
                    protocol: 'http',
                    username: device.login,
                    password: device.password,
                };

                const isCarDevice = device.type === DeviceType.CAR || caps.isSupportAnpr;
                const isFaceDevice =
                    device.type === DeviceType.ACCESS_CONTROL ||
                    device.type === DeviceType.FACE ||
                    caps.isSupportFace;

                for (const empId of employeeIds) {
                    const employeeData = employeeMap.get(empId);
                    if (!employeeData) continue;

                    // Xodimning barcha credentiallari
                    const allCredentials = employeeCredsMap.get(empId) || [];

                    //  Faqat shu qurilmaga mos keladiganlarini ajratib olamiz
                    const validCredentials = allCredentials.filter(cred => {
                        if (isCarDevice) {
                            return cred.type === ActionType.CAR;
                        }
                        if (isFaceDevice) {
                            const allowedTypes: ActionType[] = [
                                ActionType.PHOTO,
                                ActionType.CARD,
                                ActionType.PERSONAL_CODE,
                                ActionType.QR,
                            ];

                            return allowedTypes.includes(cred.type);
                        }
                        return false;
                    });

                    //  Agar mos credential umuman yo'q bo'lsa -> FAILED
                    if (validCredentials.length === 0) {
                        let errorMsg = 'Credential not found';
                        if (isCarDevice) errorMsg = 'AVTO number (CAR credential) not found!';
                        if (isFaceDevice) errorMsg = 'Access Credential not found!';

                        // CredentialId: null bo'lgan bitta umumiy xato yozamiz
                        let sync = await this.prisma.employeeSync.findFirst({
                            where: {
                                employeeId: empId,
                                deviceId: device.id,
                                gateId: gate.id,
                                credentialId: null, // null
                            },
                        });

                        if (!sync) {
                            sync = await this.prisma.employeeSync.create({
                                data: {
                                    employeeId: empId,
                                    deviceId: device.id,
                                    gateId: gate.id,
                                    credentialId: null,
                                    organizationId: employeeData.organizationId,
                                    status: StatusEnum.WAITING,
                                },
                            });
                        }
                        await this.updateSync(sync.id, StatusEnum.FAILED, errorMsg);
                        continue;
                    }

                    //  Faqat mos credentiallar uchun loop aylanamiz
                    for (const cred of validCredentials) {
                        // Sync yozuvini topish yoki yaratish
                        let sync = await this.prisma.employeeSync.findFirst({
                            where: {
                                employeeId: empId,
                                deviceId: device.id,
                                gateId: gate.id,
                                credentialId: cred.id,
                            },
                        });

                        if (sync?.status === StatusEnum.DONE) continue;

                        if (!sync) {
                            sync = await this.prisma.employeeSync.create({
                                data: {
                                    employeeId: empId,
                                    deviceId: device.id,
                                    gateId: gate.id,
                                    credentialId: cred.id,
                                    organizationId: employeeData.organizationId,
                                    status: StatusEnum.WAITING,
                                },
                            });
                        }

                        try {
                            if (isCarDevice && cred.type === ActionType.CAR) {
                                if (!cred.code) throw new Error('Car number empty');
                                await this.syncCarToDevice([cred.code], config);
                            } else if (isFaceDevice) {
                                switch (cred.type) {
                                    case ActionType.PHOTO:
                                        if (!cred.additionalDetails)
                                            throw new Error('Credentials photo not found!');

                                        await this.syncFaceToDevice(
                                            empId.toString(),
                                            cred.additionalDetails,
                                            config
                                        );
                                        break;

                                    case ActionType.PERSONAL_CODE:
                                        if (!cred.code) throw new Error('Password empty');
                                        await this.syncPasswordToDevice(
                                            empId.toString(),
                                            cred.code,
                                            config
                                        );
                                        break;

                                    case ActionType.CARD:
                                    case ActionType.QR:
                                        if (!cred.code) throw new Error('Card/QR code empty');
                                        await this.syncCardToDevice(
                                            empId.toString(),
                                            cred.code,
                                            config
                                        );
                                        break;

                                    default:
                                        throw new Error(
                                            `Unsupported credential type: ${cred.type}`
                                        );
                                }
                            }

                            await this.updateSync(sync.id, StatusEnum.DONE, 'Success!');
                        } catch (err: any) {
                            const msg = err?.message || 'Undefined error';
                            await this.updateSync(sync.id, StatusEnum.FAILED, msg);
                        }
                    }
                }
            }
        }

        return { success: true };
    }

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

    private async updateGateEmployees(gateId: number, newEmployeeIds: number[]) {
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            select: { employees: { select: { id: true, organizationId: true } } },
        });

        const oldEmployeeIds = gate.employees.map(e => e.id);

        const toConnect = newEmployeeIds.filter(id => !oldEmployeeIds.includes(id));
        const toDisconnect = oldEmployeeIds.filter(id => !newEmployeeIds.includes(id));

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

    async process(job: Job<any, any, string>) {
        switch (job.name) {
            case JOB.DEVICE.CREATE:
                return this.createDevice(job);

            case JOB.DEVICE.DELETE:
                return this.removeDeviceUsers(job);

            case JOB.DEVICE.ASSIGN_EMPLOYEES_TO_GATES:
                return this.assignEmployeesToGatesJob(job);

            case JOB.DEVICE.REMOVE_GATE_EMPLOYEE_DATA:
                return this.removeGateEmployees(job);

            case JOB.DEVICE.REMOVE_EMPLOYEES:
                return this.removeEmployeesFromDevices(job);
        }
    }
}
