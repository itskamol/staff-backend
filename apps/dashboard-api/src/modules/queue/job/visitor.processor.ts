import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { ActionType, StatusEnum, Credential, Device, Visitor, OnetimeCode } from '@prisma/client';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';

@Processor(JOB.VISITOR.NAME, { concurrency: 5 })
export class VisitorProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
        private readonly hikvisionService: HikvisionAccessService,
        private readonly logger: LoggerService
    ) {
        super();
    }

    private async processCredentialSync(
        visitor: Pick<Visitor, 'id' | 'organizationId'>,
        oneTimeCode: OnetimeCode,
        device: Device,
        gate: { id: number },
        config: HikvisionConfig
    ) {
        let sync = await this.prisma.employeeSync.findFirst({
            where: {
                gateId: gate.id,
                deviceId: device.id,
                visitorId: visitor.id,
                onetimeCodeId: oneTimeCode.id,
                deletedAt: null,
            },
        });

        if (sync?.status === StatusEnum.DONE) return;

        if (!sync) {
            sync = await this.prisma.employeeSync.create({
                data: {
                    gateId: gate.id,
                    deviceId: device.id,
                    visitorId: visitor.id,
                    onetimeCodeId: oneTimeCode.id,
                    organizationId: visitor.organizationId,
                    status: StatusEnum.WAITING,
                },
            });
        }
        try {
            if (!oneTimeCode.code) throw new Error('Card code empty');
            // Agar eski karta bo'lsa -> REPLACE

            await this.hikvisionService.createUser(visitor.id, config, true);

            await this.syncCardToDevice(
                visitor.id,
                oneTimeCode.code,
                config,
                oneTimeCode.startDate,
                oneTimeCode.endDate
            );

            await this.syncPasswordToDevice(
                visitor.id,
                oneTimeCode.code,
                config,
                oneTimeCode.startDate,
                oneTimeCode.endDate
            );

            await this.updateSync(sync.id, StatusEnum.DONE, 'Successfully synced');
        } catch (err: any) {
            await this.updateSync(sync.id, StatusEnum.FAILED, err.message);
            this.logger.error(err.message, '', 'VisitorProcessor');
        }
    }

    private async syncPasswordToDevice(
        employeeId: number,
        code: string,
        config: HikvisionConfig,
        beginTime?: Date,
        endTime?: Date
    ) {
        // await this.hikvisionService.createUser(+employeeId, config, true);

        code = code.replace('vis', '');
        await this.hikvisionService.addPasswordToUser(
            `v${employeeId}`,
            code,
            config,
            beginTime,
            endTime
        );
    }

    private async syncCardToDevice(
        employeeId: number,
        cardNo: string,
        config: HikvisionConfig,
        beginTime?: Date,
        endTime?: Date
    ) {
        await this.hikvisionService.addCardToUser({
            employeeNo: `v${employeeId}`,
            cardNo,
            config,
            beginTime,
            endTime,
        });
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

    async syncCredentialsToDevicesJob(job: Job) {
        const { gateId, onetimeCodeId } = job.data;

        // 1. Gate va qurilmalarni olamiz
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: { where: { isActive: true, deletedAt: null } } },
        });

        if (!gate?.devices?.length) return;

        // 2. Xodim va aynan so'ralgan credentiallarni olamiz
        const oneTimeCode = await this.prisma.onetimeCode.findUnique({
            where: { id: onetimeCodeId },
            include: { visitor: true },
        });

        if (!oneTimeCode) return;

        // 3. Har bir qurilmaga faqat uning turiga mos credentiallarni yuboramiz
        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            if (device.type.includes(ActionType.CARD || ActionType.PERSONAL_CODE)) {
                try {
                    await this.processCredentialSync(
                        oneTimeCode.visitor,
                        oneTimeCode,
                        device,
                        gate,
                        config
                    );
                } catch (err) {
                    this.logger.error(
                        `Sync failed [Dev: ${device.id}, Cred: ${onetimeCodeId}]: ${err.message}`
                    );
                }
            }
        }
    }

    async removeVisitorsFromAllDevicesJob(job: Job) {
        const { visitorIds } = job.data;

        if (!visitorIds.length) {
            this.logger.warn('No visitor provided', 'VisitorJob');
            return;
        }

        const visitors = await this.prisma.visitor.findMany({
            where: {
                id: { in: visitorIds },
                isActive: true,
            },
            include: {
                onetimeCodes: {
                    where: { deletedAt: null, isActive: true },
                },
                gate: {
                    where: { deletedAt: null, isActive: true },
                    include: { devices: { where: { deletedAt: null, isActive: true } } },
                },
            },
        });

        if (!visitors.length) {
            this.logger.warn(`No visitor found for ids: ${visitorIds.join(', ')}`, 'VisitorJob');
            return;
        }

        for (const visitor of visitors) {
            if (!visitor.gate.devices.length) continue;

            for (const device of visitor.gate.devices) {
                const config = this.getDeviceConfig(device);

                try {
                    // 🔹 ACCESS
                    const accessTypes: ActionType[] = [
                        ActionType.PHOTO,
                        ActionType.CARD,
                        ActionType.PERSONAL_CODE,
                        ActionType.QR,
                    ];

                    if (device.type.some(t => accessTypes.includes(t))) {
                        await this.hikvisionService.deleteUser(`v${visitor.id}`, config);
                    }

                    // 🔹 Sync close
                    await this.prisma.employeeSync.updateMany({
                        where: {
                            deviceId: device.id,
                            visitorId: visitor.id,
                            deletedAt: null,
                        },
                        data: { deletedAt: new Date() },
                    });
                } catch (err) {
                    this.logger.error(
                        `Failed removing visitor ${visitor.id} from device ${device.id}: ${err.message}`,
                        'VisitorJob'
                    );
                }
            }

            this.logger.log(
                `Employee ${visitor.id} removed from all devices (${visitor.gate.devices.length})`,
                'DeviceJob'
            );
        }
    }

    async process(job: Job<any, any, string>) {
        switch (job.name) {
            case JOB.VISITOR.SYNC_CREDENTIALS_TO_DEVICES_VISITOR:
                return this.syncCredentialsToDevicesJob(job);

            case JOB.VISITOR.REMOVE_VISITORS_FROM_ALL_DEVICES:
                return this.removeVisitorsFromAllDevicesJob(job);
        }
    }
}
