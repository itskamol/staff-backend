import { Logger } from '@nestjs/common';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import { GatewayConfigService } from './gateway-config.service';
import { GatewayRegistryService } from './gateway-registry.service';
import {
    GatewayControlInboundMessage,
    GatewayAckPayload,
    GatewayCommandEnvelope,
    GatewayHeartbeatPayload,
} from '@app/shared/gateway';
import { GatewayCommandService, GatewayCommandRecord } from './gateway-command.service';

interface GatewaySocketContext {
    gatewayId: string;
    organizationId?: number;
}

@WebSocketGateway({
    path: '/ws',
})
export class GatewayControlGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(GatewayControlGateway.name);
    private readonly sockets = new Map<WebSocket, GatewaySocketContext>();
    private readonly socketsByGateway = new Map<string, WebSocket>();

    constructor(
        private readonly config: GatewayConfigService,
        private readonly registry: GatewayRegistryService,
        private readonly commands: GatewayCommandService
    ) {}

    handleConnection(client: WebSocket, request: IncomingMessage): void {
        const apiKey = request.headers['x-api-key'] as string | undefined;
        if (!this.config.isApiKeyValid(apiKey)) {
            this.logger.warn('Rejected control channel connection: invalid API key');
            client.close(4401, 'invalid_api_key');
            return;
        }

        const gatewayId = this.extractGatewayId(request);
        if (!gatewayId) {
            this.logger.warn('Rejected control channel connection: missing gateway id');
            client.close(4400, 'missing_gateway_id');
            return;
        }

        const context: GatewaySocketContext = {
            gatewayId,
            organizationId: this.extractOrganizationId(request),
        };

        this.sockets.set(client, context);
        this.socketsByGateway.set(gatewayId, client);
        this.logger.log(`Gateway ${gatewayId} connected to control channel`);

        client.on('message', data => this.handleMessage(client, data));

        void this.dispatchPendingCommands(gatewayId);
    }

    handleDisconnect(client: WebSocket): void {
        const context = this.sockets.get(client);
        if (!context) {
            return;
        }

        this.registry.markDisconnected(context.gatewayId);
        this.logger.log(`Gateway ${context.gatewayId} disconnected from control channel`);
        this.sockets.delete(client);
        this.socketsByGateway.delete(context.gatewayId);
    }

    private handleMessage(client: WebSocket, data: RawData): void {
        const context = this.sockets.get(client);
        if (!context) {
            client.close(4403, 'unauthorized');
            return;
        }

        try {
            const payload = JSON.parse(String(data)) as GatewayControlInboundMessage;
            if (payload?.type === 'heartbeat') {
                const heartbeat = payload as GatewayHeartbeatPayload;
                this.registry.updateHeartbeat({
                    ...heartbeat,
                    organizationId: heartbeat.organizationId ?? context.organizationId,
                });
                return;
            }

            if (payload?.type === 'ack') {
                const ack = payload as GatewayAckPayload;
                this.commands.handleAck(ack);
                return;
            }
        } catch (error) {
            this.logger.warn(
                `Failed to parse control message from gateway ${context.gatewayId}: ${(error as Error).message}`
            );
        }
    }

    async dispatchPendingCommands(gatewayId: string): Promise<void> {
        const socket = this.socketsByGateway.get(gatewayId);
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            this.logger.debug(
                `Gateway ${gatewayId} not connected. Pending commands will be sent upon reconnect.`
            );
            return;
        }

        const pending = await this.commands.getPendingCommands(gatewayId);
        for (const command of pending) {
            this.sendCommand(socket, command);
        }
    }

    private sendCommand(socket: WebSocket, command: GatewayCommandRecord): void {
        const envelope: GatewayCommandEnvelope = {
            type: 'command',
            command: {
                id: command.id,
                type: command.type,
                payload: command.payload as Record<string, unknown>,
                requiresAck: command.requiresAck,
            },
        };

        socket.send(JSON.stringify(envelope), err => {
            if (err) {
                this.logger.error(
                    `Failed to dispatch command ${command.id} to gateway ${command.gatewayId}: ${err.message}`
                );
                return;
            }

            void this.commands
                .markSent(command.id)
                .catch(error =>
                    this.logger.error(
                        `Failed to mark command ${command.id} as sent: ${(error as Error).message}`
                    )
                );
            this.logger.log(`Dispatched command ${command.id} to gateway ${command.gatewayId}`);
        });
    }

    private extractGatewayId(request: IncomingMessage): string | null {
        const header = request.headers['x-gateway-id'];
        if (Array.isArray(header)) {
            return header[0] ?? null;
        }
        return header ?? null;
    }

    private extractOrganizationId(request: IncomingMessage): number | undefined {
        const header = request.headers['x-organization-id'];
        const value = Array.isArray(header) ? header[0] : header;
        if (!value) return undefined;

        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
    }
}
