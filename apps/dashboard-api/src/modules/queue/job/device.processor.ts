import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { DeviceService } from '../../devices/services/device.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { StatusEnum } from '@prisma/client';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';

@Processor(JOB.DEVICE.NAME, { concurrency: 1 })
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
            if (newDevice?.type === 'CAR') {
                await this.hikvisionAnprService.configureAnprEventHost(
                    hikvisionConfig,
                    newDevice?.id
                );
            }
            if (newDevice?.type === 'ACCESS_CONTROL' || newDevice?.type === 'FACE') {
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

    async removeDeviceUsers(job: Job) {
        const { device, config } = job.data;
        try {
            const gate = await this.prisma.gate.findFirstOrThrow({
                where: { id: device.gateId },
                select: {
                    employees: {
                        select: {
                            id: true,
                            credentials: {
                                where: { isActive: true },
                                select: {
                                    code: true,
                                    type: true,
                                },
                            },
                        },
                    },
                },
            });

            for (const e of gate.employees) {
                try {
                    if (device.type === 'CAR') {
                        const carCreds = e.credentials.filter(c => c.type === 'CAR');

                        if (carCreds.length > 0) {
                            for (const cred of carCreds) {
                                if (cred.code) {
                                    await this.hikvisionAnprService.deleteLicensePlate(
                                        cred.code,
                                        config
                                    );
                                }
                            }
                        }
                    }

                    if (device?.type === 'ACCESS_CONTROL' || device?.type === 'FACE') {
                        await this.hikvisionService.deleteUser(String(e.id), config);
                    }
                } catch (err) {
                    this.logger.warn(`Employee ${e.id} not deleted: ${err.message}`, 'DeviceJob');
                }
            }

            this.logger.log(`Device ${device.id} users deleted`, 'DeviceJob');
        } catch (err) {
            this.logger.error(`removeDeviceUsers failed:`, err.message, 'DeviceJob');
        }
    }

    async removeGateEmployeesToDevices(gateId: number, employeeIds: number[]) {
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

        const carCredentials = await this.prisma.credential.findMany({
            where: {
                employeeId: { in: employeeIds },
                type: 'CAR',
                isActive: true,
            },
            select: { employeeId: true, code: true },
        });

        const carMap = new Map<number, string[]>();
        carCredentials.forEach(c => {
            const list = carMap.get(c.employeeId) || [];
            if (c.code) list.push(c.code);
            carMap.set(c.employeeId, list);
        });

        for (const device of gate.devices) {
            const config: HikvisionConfig = {
                host: device.ipAddress,
                port: 80,
                protocol: 'http',
                username: device.login,
                password: device.password,
            };

            const caps = (device.capabilities as any) || {};
            const isAnpr = device.type === 'CAR' || caps.isSupportAnpr;

            for (const empId of employeeIds) {
                try {
                    if (isAnpr) {
                        const plates = carMap.get(empId);
                        if (plates && plates.length > 0) {
                            for (const plate of plates) {
                                const data = await this.hikvisionAnprService.deleteLicensePlate(
                                    plate,
                                    config
                                );
                                if (data) {
                                    this.logger.log(
                                        `[DeviceJob] Removed plate ${plate} (User ${empId}) from ANPR ${device.id}`
                                    );
                                }
                            }
                        }
                    } else {
                        await this.hikvisionService.deleteUser(String(empId), config);
                        this.logger.log(
                            `[DeviceJob] Removed user ${empId} from Access Device ${device.id}`
                        );
                    }
                } catch (err) {
                    this.logger.warn(
                        `[DeviceJob] Failed to clean up user ${empId} on device ${device.id}: ${err.message}`
                    );
                }
            }
        }

        this.logger.log(
            `[DeviceJob] Gate ${gateId} - cleanup completed for employees: ${employeeIds.join(
                ', '
            )}`
        );
    }

    async assignEmployeesToGatesJob(job: Job) {
        const { port, ip, scope, dto } = job.data;
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
                type: { in: ['PHOTO', 'CAR'] },
                deletedAt: null,
            },
            select: { id: true, employeeId: true, type: true, code: true },
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

                for (const empId of employeeIds) {
                    const employeeData = employeeMap.get(empId);
                    const empCredentials = employeeCredsMap.get(empId) || [];

                    if (!employeeData) continue;

                    for (const cred of empCredentials) {
                        const isCarDevice = device.type === 'CAR' || caps.isSupportAnpr;
                        const isFaceDevice = device.type === 'ACCESS_CONTROL' || caps.isSupportFace;

                        if (isCarDevice && cred.type !== 'CAR') continue;
                        if (isFaceDevice && cred.type !== 'PHOTO') continue;

                        let sync = await this.prisma.employeeSync.findFirst({
                            where: {
                                employeeId: empId,
                                deviceId: device.id,
                                gateId: gate.id,
                                credentialId: cred.id,
                            },
                        });

                        if (sync?.status === 'DONE') continue;

                        if (!sync) {
                            sync = await this.prisma.employeeSync.create({
                                data: {
                                    employeeId: empId,
                                    deviceId: device.id,
                                    gateId: gate.id,
                                    credentialId: cred.id,
                                    organizationId: employeeData.organizationId,
                                    status: 'WAITING',
                                },
                            });
                        }

                        try {
                            if (isCarDevice && cred.type === 'CAR') {
                                if (!cred.code) throw new Error('Mashina raqami (code) yo‘q');
                                await this.syncCarToDevice([cred.code], config);
                            } else if (isFaceDevice && cred.type === 'PHOTO') {
                                if (!employeeData.photo)
                                    throw new Error('Xodimning rasmi (fayl) yo‘q');

                                const photoUrl = `http://${ip}:${port}/api/storage/${employeeData.photo}`;
                                await this.syncFaceToDevice(empId.toString(), photoUrl, config);
                            }

                            await this.updateSync(sync.id, 'DONE', 'Success!');
                        } catch (err: any) {
                            const msg = err?.message || 'Undefined error';
                            await this.updateSync(sync.id, 'FAILED', msg);
                        }
                    }
                }
            }
        }

        return { success: true };
    }

    private async syncFaceToDevice(employeeId: string, photoUrl: string, config: HikvisionConfig) {
        await this.hikvisionService.createUser(
            {
                employeeId,
            },
            config
        );

        await this.hikvisionService.addFaceToUserViaURL(employeeId, photoUrl, config);
    }

    private async syncCarToDevice(carNumbers: string[], config: HikvisionConfig) {
        for (const plate of carNumbers) {
            await this.hikvisionAnprService.addLicensePlate(plate, '1', config);
        }
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
        }
    }
}
