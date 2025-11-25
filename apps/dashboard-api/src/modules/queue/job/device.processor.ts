import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { HikvisionService } from '../../hikvision/hikvision.service';
import { DeviceService } from '../../devices/services/device.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { StatusEnum } from '@prisma/client';

@Processor(JOB.DEVICE.NAME, { concurrency: 1 })
export class DeviceProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
        private readonly hikvisionService: HikvisionService,
        private readonly device: DeviceService,
        private readonly logger: LoggerService
    ) {
        super();
    }

    async createDevice(job: Job) {
        const { hikvisionConfig, newDeviceId, gateId, scope } = job.data;

        try {
            await this.hikvisionService.configureEventListeningHost(hikvisionConfig, newDeviceId);

            const gate = await this.prisma.gate.findFirstOrThrow({
                where: { id: gateId },
                select: { employees: { select: { id: true } } },
            });
            const employeeIds = gate?.employees?.map(e => e.id);

            let effectiveScope = scope || {};
            if (!effectiveScope.organizationId) {
                const gate = await this.prisma.gate.findFirst({ where: { id: gateId } });
                if (gate) effectiveScope.organizationId = gate.organizationId;
            }

            await this.device.assignEmployeesToGates(
                { gateIds: [gateId], employeeIds },
                effectiveScope
            );
            this.logger.log(`[DeviceJob] Device ${newDeviceId} background tasks completed`);
        } catch (err) {
            this.logger.error(
                `[DeviceJob] Device ${newDeviceId} background job failed:`,
                err.message
            );
        }
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
                        },
                    },
                },
            });

            for (const e of gate.employees) {
                try {
                    await this.hikvisionService.deleteUser(String(e.id), config);
                } catch (err) {
                    this.logger.warn(`[DeviceJob] Employee ${e.id} not deleted: ${err.message}`);
                }
            }

            this.logger.log(`[DeviceJob] Device ${device.id} users deleted`);
        } catch (err) {
            this.logger.error(`[DeviceJob] removeDeviceUsers failed:`, err.message);
        }
    }

    async removeGateEmployeesByData(data: { gateId: number; employeeIds: number[] }) {
        const { gateId, employeeIds } = data;

        const gate = await this.prisma.gate.findFirstOrThrow({
            where: { id: gateId },
            select: {
                id: true,
                devices: {
                    select: { id: true, ipAddress: true, login: true, password: true },
                },
            },
        });

        for (const device of gate.devices) {
            const config: HikvisionConfig = {
                host: device.ipAddress,
                port: 80,
                protocol: 'http',
                username: device.login,
                password: device.password,
            };

            for (const empId of employeeIds) {
                try {
                    await this.hikvisionService.deleteUser(String(empId), config);
                    this.logger.log(`[DeviceJob] Removed user ${empId} from device ${device.id}`);
                } catch (err) {
                    this.logger.warn(
                        `[DeviceJob] Failed to delete user ${empId} from device ${device.id}: ${err.message}`
                    );
                }
            }
        }
        this.logger.log(
            `[DeviceJob] Gate ${gateId} - employees removed: ${employeeIds.join(', ')}`
        );
    }

    async assignEmployeesToGatesJob(job: Job) {
        const { port, ip, scope, dto } = job.data;
        const { gateIds, employeeIds } = dto;

        if (!gateIds?.length || !employeeIds?.length) return;

        const organizationId = dto.organizationId ? dto.organizationId : scope.organizationId;

        const gates = await this.prisma.gate.findMany({
            where: { id: { in: gateIds } },
            include: { devices: true },
        });

        if (!gates.length) return;

        const employees = await this.prisma.employee.findMany({
            where: {
                id: {
                    in: employeeIds,
                },
            },
            select: {
                id: true,
            },
        });

        if (!employees.length) return;

        const credentials = await this.prisma.credential.findMany({
            where: { employeeId: { in: employeeIds }, type: 'PHOTO', isActive: true },
            select: { employeeId: true },
        });

        const credMap = new Map(credentials.map(c => [c.employeeId, true]));

        for (const gate of gates) {
            const syncEmployees = await this.updateGateEmployees(gate.id, employeeIds);

            if (syncEmployees.disconnected.length > 0) {
                await this.removeGateEmployeesByData({
                    gateId: gate.id,
                    employeeIds: syncEmployees.disconnected,
                });
            }

            if (!gate.devices?.length) {
                continue;
            }

            for (const device of gate.devices) {
                const caps = (device.capabilities as any) || {};

                if (!caps.isSupportFace) {
                    continue;
                }

                for (const empId of employeeIds) {
                    const employee = await this.prisma.employee.findUnique({
                        where: { id: empId },
                        select: { photo: true, name: true },
                    });

                    let sync = await this.prisma.employeeSync.findFirst({
                        where: {
                            employeeId: empId,
                            deviceId: device.id,
                            gateId: gate.id,
                        },
                    });

                    if (sync?.status == 'DONE') continue;

                    if (!sync) {
                        sync = await this.prisma.employeeSync.create({
                            data: {
                                employeeId: empId,
                                deviceId: device.id,
                                gateId: gate.id,
                                organizationId,
                                status: 'WAITING',
                            },
                        });
                    }

                    try {
                        if (!credMap.has(empId)) {
                            throw new Error('Photo credential is not found!');
                        }
                        const config: HikvisionConfig = {
                            host: device.ipAddress,
                            port: 80,
                            protocol: 'http',
                            username: device.login,
                            password: device.password,
                        };

                        await this.hikvisionService.createUser(
                            {
                                employeeId: empId.toString(),
                                userType: 'normal',
                                beginTime: '2025-01-01T00:00:00',
                                endTime: '2035-12-31T23:59:59',
                            },
                            config
                        );
                        await this.updateSync(sync.id, 'PROCESS', 'User created!');

                        if (!employee?.photo) throw new Error('Foto is not found!');

                        const photoUrl = `http://${ip}:${port}/api/storage/${employee.photo}`;
                        await this.hikvisionService.addFaceToUserViaURL(
                            empId.toString(),
                            photoUrl,
                            config
                        );

                        await this.updateSync(sync.id, 'DONE', 'Success!');
                    } catch (err: any) {
                        const msg = err?.message || 'Undifined error';
                        await this.updateSync(sync.id, 'FIELD', msg);
                    }
                }
            }
        }

        return { success: true };
    }

    private async updateGateEmployees(gateId: number, newEmployeeIds: number[]) {
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            select: { employees: { select: { id: true } } },
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
        }
    }
}
