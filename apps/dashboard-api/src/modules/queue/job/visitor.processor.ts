import { PrismaService } from '@app/shared/database';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { ActionType, StatusEnum, Credential, Device, Visitor, OnetimeCode } from '@prisma/client';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';

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

    /**
     * Xodimlarni darvozaga biriktirish va sinxronizatsiya
     */
    async assignVisitorsToGatesJob(job: Job) {
        const { dto } = job.data;
        const { gateId, visitorIds } = dto;
        const credentialTypes = [ActionType.CARD, ActionType.QR];
        if (!gateId) return;
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: { where: { isActive: true, deletedAt: null } } },
        });
        if (!gate || !gate.devices.length) return;

        const { connected, disconnected } = await this.updateGateVisitors(gate.id, visitorIds);
        if (disconnected.length > 0) {
            await this.removeGateVisitorsToDevices(gate.id, disconnected);
        }

        if (connected.length === 0) return { success: true, message: 'No new visitors to sync' };

        const visitors = await this.prisma.visitor.findMany({
            where: { id: { in: connected } },
            include: {
                onetimeCodes: {
                    where: {
                        isActive: true,
                        deletedAt: null,
                    },
                },
            },
        });
        if (!gate.devices?.length || !credentialTypes.length) return;

        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            for (const visitor of visitors) {
                for (const code of visitor.onetimeCodes) {
                    if (device.type.includes(ActionType.CARD || ActionType.PERSONAL_CODE)) {
                        await this.processCredentialSync(visitor, code, device, gate, config);
                    }
                }
            }
        }
        return { success: true };
    }

    /**
     * Qurilmadan xodimni o'chirish logikasi (FAQAT type massivi orqali)
     */
    private async processRemovalFromDevice(config: HikvisionConfig, visitorId: number) {
        await this.hikvisionService.deleteUser(`v${visitorId}`, config);
    }

    /**
     * Darvozadan uzilgan xodimlarni qurilmalardan tozalash
     */
    async removeGateVisitorsToDevices(gateId: number, visitorIds: number[]) {
        const gate = await this.prisma.gate.findFirst({
            where: { id: gateId },
            include: { devices: true },
        });

        if (!gate?.devices?.length) return;

        const visitors = await this.prisma.visitor.findMany({
            where: { id: { in: visitorIds } },
            include: { onetimeCodes: { where: { isActive: true, deletedAt: null } } },
        });

        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            if (!device.type.includes(ActionType.CARD || ActionType.PERSONAL_CODE || ActionType.QR))
                continue;

            for (const vis of visitors) {
                try {
                    await this.processRemovalFromDevice(config, vis.id);
                    await this.prisma.employeeSync.updateMany({
                        where: { gateId, deviceId: device.id, visitorId: vis.id, deletedAt: null },
                        data: { deletedAt: new Date() },
                    });
                } catch (err) {
                    this.logger.error(
                        `Removal failed [Dev: ${device.id}, Vis: ${vis.id}]: ${err.message}`
                    );
                }
            }
        }
    }

    private async processCredentialSync(
        visitor: Pick<Visitor, 'id' | 'organizationId'>,
        oneTimeCode: OnetimeCode,
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
                visitorId: visitor.id,
                onetimeCodeId: oneTimeCode.id,
                deletedAt: null,
            },
        });

        if (sync?.status === StatusEnum.DONE && !isUpdate) return;

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
            if (oldCode && oldCode !== oneTimeCode.code) {
                await this.hikvisionService.replaceCard(
                    oldCode,
                    oneTimeCode.code,
                    String(visitor.id),
                    config
                );
            } else {
                await this.syncCardToDevice(
                    visitor.id.toString(),
                    oneTimeCode.code,
                    config,
                    new Date(oneTimeCode.startDate),
                    new Date(oneTimeCode.endDate)
                );
                await this.syncPasswordToDevice(
                    visitor.id.toString(),
                    oneTimeCode.code || '',
                    config,
                    oneTimeCode.startDate,
                    oneTimeCode.endDate
                );
            }

            await this.updateSync(
                sync.id,
                StatusEnum.DONE,
                isUpdate ? 'Successfully updated' : 'Successfully synced'
            );
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

    private async updateGateVisitors(gateId: number, newVisitorIds: number[]) {
        const gate = await this.prisma.device.findUnique({
            where: { id: gateId },
            select: { visitors: { select: { id: true } } },
        });
        const oldIds = gate?.visitors.map(e => e.id) || [];
        const toConnect = newVisitorIds.filter(id => !oldIds.includes(id));
        const toDisconnect = oldIds.filter(id => !newVisitorIds.includes(id));

        await this.prisma.device.update({
            where: { id: gateId },
            data: {
                visitors: {
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
        const { gateId, visitorId, credentialIds, oldCode } = job.data;

        // 1. Gate va qurilmalarni olamiz
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            include: { devices: { where: { isActive: true, deletedAt: null } } },
        });

        if (!gate?.devices?.length) return;

        // 2. Xodim va aynan so'ralgan credentiallarni olamiz
        const visitors = await this.prisma.visitor.findUnique({
            where: { id: visitorId },
            include: {
                onetimeCodes: {
                    where: { id: { in: credentialIds }, isActive: true, deletedAt: null },
                },
            },
        });

        if (!visitors || !visitors.onetimeCodes.length) return;

        // 3. Har bir qurilmaga faqat uning turiga mos credentiallarni yuboramiz
        for (const device of gate.devices) {
            const config = this.getDeviceConfig(device);
            for (const cred of visitors.onetimeCodes) {
                if (device.type.includes(ActionType.CARD || ActionType.PERSONAL_CODE)) {
                    try {
                        // Mavjud processCredentialSync funksiyasini ishlatamiz
                        // U EmployeeSync jadvalini o'zi tekshiradi va yaratadi
                        await this.processCredentialSync(
                            visitors,
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
            case JOB.VISITOR.ASSIGN_TO_GATES:
                return this.assignVisitorsToGatesJob(job);

            case JOB.DEVICE.REMOVE_SPECIFIC_CREDENTIALS:
                return this.removeSpecificCredentialsJob(job);

            case JOB.DEVICE.SYNC_CREDENTIALS_TO_DEVICES: // <-- YANGI CASE
                return this.syncCredentialsToDevicesJob(job);
        }
    }
}
