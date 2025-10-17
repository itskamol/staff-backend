import { Injectable, Logger } from '@nestjs/common';
import {
    GatewayCommand as GatewayCommandEntity,
    GatewayCommandAckStatus,
    GatewayCommandStatus,
    Prisma,
} from '@prisma/client';
import { GatewayAckPayload, GatewayCommandPayload } from '@app/shared/gateway';
import { PrismaService } from '@app/shared/database';

export type GatewayCommandRecord = GatewayCommandEntity;

@Injectable()
export class GatewayCommandService {
    private readonly logger = new Logger(GatewayCommandService.name);

    constructor(private readonly prisma: PrismaService) {}

    async createCommand(
        gatewayId: string,
        payload: Omit<GatewayCommandPayload, 'id'>
    ): Promise<GatewayCommandRecord> {
        const record = await this.prisma.gatewayCommand.create({
            data: {
                gatewayId,
                type: payload.type,
                payload: payload.payload as Prisma.JsonValue,
                requiresAck: payload.requiresAck ?? true,
                status: GatewayCommandStatus.PENDING,
            },
        });

        this.logger.log(`Queued command ${record.id} for gateway ${gatewayId} (${record.type})`);
        return record;
    }

    async getCommand(commandId: string): Promise<GatewayCommandRecord | null> {
        return this.prisma.gatewayCommand.findUnique({ where: { id: commandId } });
    }

    async listCommands(gatewayId?: string): Promise<GatewayCommandRecord[]> {
        return this.prisma.gatewayCommand.findMany({
            where: gatewayId ? { gatewayId } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getPendingCommands(gatewayId: string): Promise<GatewayCommandRecord[]> {
        return this.prisma.gatewayCommand.findMany({
            where: {
                gatewayId,
                status: GatewayCommandStatus.PENDING,
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async markSent(commandId: string): Promise<void> {
        await this.prisma.gatewayCommand.update({
            where: { id: commandId },
            data: {
                status: GatewayCommandStatus.SENT,
                sentAt: new Date(),
            },
        });
    }

    async handleAck(ack: GatewayAckPayload): Promise<GatewayCommandRecord | null> {
        try {
            const record = await this.prisma.gatewayCommand.update({
                where: { id: ack.commandId },
                data: {
                    ackAt: new Date(ack.timestamp),
                    ackStatus:
                        ack.status === 'accepted'
                            ? GatewayCommandAckStatus.ACCEPTED
                            : GatewayCommandAckStatus.REJECTED,
                    ackError: ack.error,
                    status:
                        ack.status === 'accepted'
                            ? GatewayCommandStatus.ACKNOWLEDGED
                            : GatewayCommandStatus.FAILED,
                },
            });

            this.logger.log(
                `Command ${record.id} acknowledged with status ${ack.status}${ack.error ? ` (${ack.error})` : ''}`
            );
            return record;
        } catch (error) {
            this.logger.warn(`Received ACK for unknown command ${ack.commandId}`);
            return null;
        }
    }
}
