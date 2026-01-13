import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { ActionType, StatusEnum, Credential, Device, Visitor, OnetimeCode } from '@prisma/client';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';
import { on } from 'events';

@Processor(JOB.VISITOR.NAME, { concurrency: 5 })
export class VisitorProcessor extends WorkerHost {
    constructor(
        private readonly prisma: PrismaService,
        private readonly hikvisionService: HikvisionAccessService,
        private readonly hikvisionAnprService: HikvisionAnprService,
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
            await this.syncCardToDevice(
                visitor.id.toString(),
                oneTimeCode.code,
                config,
                oneTimeCode.startDate,
                oneTimeCode.endDate
            );

            await this.syncPasswordToDevice(
                visitor.id.toString(),
                oneTimeCode.code,
                config,
                oneTimeCode.startDate,
                oneTimeCode.endDate
            );

            await this.updateSync(sync.id, StatusEnum.DONE, 'Successfully synced');
        } catch (err: any) {
            await this.updateSync(sync.id, StatusEnum.FAILED, err.message);
            this.logger.error(err.message, '', 'VisitorProcessor'); // Yuqoriga catch qilish uchun
        }
    }

    private async syncPasswordToDevice(
        employeeId: string,
        code: string,
        config: HikvisionConfig,
        beginTime?: Date,
        endTime?: Date
    ) {
        await this.hikvisionService.createUser(+employeeId, config, true);

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
        employeeId: string,
        cardNo: string,
        config: HikvisionConfig,
        beginTime?: Date,
        endTime?: Date
    ) {
        await this.hikvisionService.createUser(+employeeId, config, true);
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

    async removeSpecificCredentialsJob(job: Job) {
        const { gateId, onetimeCodeId } = job.data;

        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: true },
        });

        const onetimeCode = await this.prisma.onetimeCode.findUnique({
            where: { id: onetimeCodeId, isActive: true, deletedAt: null },
        });

        if (!gate?.devices?.length || !onetimeCode) return;

        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);

            // Yangi granular metodni chaqiramiz
            await this.processSpecificCredentialRemoval(
                device,
                config,
                onetimeCode.visitorId,
                onetimeCode
            );

            // Faqat o'chirilgan credentiallar uchun Sync statusini yangilaymiz
            await this.prisma.employeeSync.updateMany({
                where: {
                    gateId,
                    deviceId: device.id,
                    visitorId: onetimeCode.visitorId,
                    onetimeCodeId: onetimeCodeId,
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
        visitorId: number,
        onetimeCode: OnetimeCode
    ) {
        try {
            if (onetimeCode.code) {
                await this.hikvisionService.deleteCard({
                    employeeNo: `v${visitorId}`,
                    cardNo: onetimeCode.code,
                    config,
                });

                await this.hikvisionService.addPasswordToUser(`v${visitorId}`, '', config);
            }
        } catch (err) {
            this.logger.error(
                `Granular removal failed [Type: ${onetimeCode.codeType}, ID: ${onetimeCode.id}] from Device ${device.id}: ${err.message}`
            );
        }
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

    async removeVisitorFromAllDevicesJob(job: Job) {
        const { visitorId } = job.data;

        // 1. Employee va credentiallarni olamiz
        const visitor = await this.prisma.visitor.findUnique({
            where: { id: visitorId },
            include: {
                onetimeCodes: {
                    where: { deletedAt: null, isActive: true },
                },
                gate: {
                    where: { deletedAt: null, isActive: true },
                    include: { devices: true },
                },
            },
        });

        if (!visitor) {
            this.logger.warn(`Employee ${visitorId} not found`, 'DeviceJob');
            return;
        }

        if (!visitor.gate.devices.length) {
            this.logger.log(`Employee ${visitor} has no devices`, 'DeviceJob');
            return;
        }

        // 2. Har bir device bo‘yicha tozalaymiz
        for (const device of visitor.gate.devices) {
            const config = this.getDeviceConfig(device);

            try {
                // 🔹 ACCESS qurilmalar
                const accessTypes: ActionType[] = [
                    ActionType.CARD,
                    ActionType.PERSONAL_CODE,
                    ActionType.QR,
                ];

                if (device.type.some(t => accessTypes.includes(t))) {
                    await this.hikvisionService.deleteUser(`v${visitorId}`, config);
                }

                // 🔹 employeeSync yopiladi
                await this.prisma.employeeSync.updateMany({
                    where: {
                        deviceId: device.id,
                        visitorId,
                        deletedAt: null,
                    },
                    data: { deletedAt: new Date() },
                });
            } catch (err) {
                this.logger.error(
                    `Failed removing employee ${visitor} from device ${device.id}: ${err.message}`,
                    'DeviceJob'
                );
            }
        }

        this.logger.log(
            `Employee ${visitorId} removed from all devices (${visitor.gate.devices.length})`,
            'DeviceJob'
        );
    }

    async process(job: Job<any, any, string>) {
        switch (job.name) {
            case JOB.VISITOR.REMOVE_SPECIFIC_CREDENTIALS_VISITOR:
                return this.removeSpecificCredentialsJob(job);

            case JOB.VISITOR.SYNC_CREDENTIALS_TO_DEVICES_VISITOR: // <-- YANGI CASE
                return this.syncCredentialsToDevicesJob(job);

            case JOB.VISITOR.REMOVE_VISITOR_FROM_ALL_DEVICES: // ✅ YANGI
                return this.removeVisitorFromAllDevicesJob(job);
        }
    }
}
