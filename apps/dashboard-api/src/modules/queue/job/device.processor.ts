import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost, } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { HikvisionService } from '../../hikvision/hikvision.service';
import { DeviceService } from '../../devices/services/device.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';



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

            const employees = await this.prisma.gateEmployee.findMany({ where: { gateId } });
            const employeeIds = employees.map((e) => e.employeeId);

            let effectiveScope = scope || {};
            if (!effectiveScope.organizationId) {
                const gate = await this.prisma.gate.findFirst({ where: { id: gateId } });
                if (gate) effectiveScope.organizationId = gate.organizationId;
            }

            await this.device.assignEmployeesToGates({ gateIds: [gateId], employeeIds }, effectiveScope);
            this.logger.log(`[DeviceJob] Device ${newDeviceId} background tasks completed`);
        } catch (err) {
            this.logger.error(`[DeviceJob] Device ${newDeviceId} background job failed:`, err.message);
        }
    }

    async removeDeviceUsers(job: Job) {
        const { device, config } = job.data;

        try {
            const employees = await this.prisma.gateEmployee.findMany({
                where: { gateId: device.gateId },
            });

            for (const e of employees) {
                try {
                    await this.hikvisionService.deleteUser(String(e.employeeId), config);
                } catch (err) {
                    this.logger.warn(`[DeviceJob] Employee ${e.employeeId} not deleted: ${err.message}`);
                }
            }

            this.logger.log(`[DeviceJob] Device ${device.id} users deleted`);
        } catch (err) {
            this.logger.error(`[DeviceJob] removeDeviceUsers failed:`, err.message);
        }
    }

    // Map jobs to methods
    async process(job: Job<any, any, string>) {
        if (job.name === JOB.DEVICE.CREATE) return this.createDevice(job);
        if (job.name === JOB.DEVICE.DELETE) return this.removeDeviceUsers(job);
    }
}