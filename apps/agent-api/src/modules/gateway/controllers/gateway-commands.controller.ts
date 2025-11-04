import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GatewayCommandService } from '../services/gateway-command.service';
import { GatewayControlGateway } from '../services/gateway-control.gateway';
import {
    CreateGatewayCommandDto,
    GatewayCommandResponseDto,
} from '../dto/create-gateway-command.dto';
import { GatewayCommandRecord } from '../services/gateway-command.service';

@Controller('gateway/:gatewayId/commands')
export class GatewayCommandsController {
    constructor(
        private readonly commands: GatewayCommandService,
        private readonly controlGateway: GatewayControlGateway
    ) {}

    @Get()
    async listCommands(
        @Param('gatewayId') gatewayId: string
    ): Promise<GatewayCommandResponseDto[]> {
        const records = await this.commands.listCommands(gatewayId);
        return records.map(record => this.mapToResponse(record));
    }

    @Post()
    async enqueueCommand(
        @Param('gatewayId') gatewayId: string,
        @Body() dto: CreateGatewayCommandDto
    ): Promise<GatewayCommandResponseDto> {
        const command = await this.commands.createCommand(gatewayId, dto);
        await this.controlGateway.dispatchPendingCommands(gatewayId);
        return this.mapToResponse(command);
    }

    private mapToResponse(record: GatewayCommandRecord): GatewayCommandResponseDto {
        return {
            id: record.id,
            gatewayId: record.gatewayId,
            type: record.type,
            payload: (record.payload as Record<string, unknown>) ?? {},
            requiresAck: record.requiresAck ?? undefined,
            status: record.status,
            createdAt: record.createdAt.toISOString(),
            sentAt: record.sentAt ? record.sentAt.toISOString() : undefined,
            ackAt: record.ackAt ? record.ackAt.toISOString() : undefined,
            ackStatus: record.ackStatus ?? undefined,
            ackError: record.ackError ?? undefined,
        };
    }
}
