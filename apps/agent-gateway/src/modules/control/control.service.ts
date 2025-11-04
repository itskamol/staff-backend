import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import WebSocket, { RawData } from 'ws';
import { GatewayConfigService } from '../../config/gateway-config.service';
import { GatewayBufferService } from '../buffer/gateway-buffer.service';
import {
    GatewayAckPayload,
    GatewayCommandEnvelope,
    GatewayControlInboundMessage,
    GatewayControlOutboundMessage,
    GatewayHeartbeatPayload,
} from '@app/shared/gateway';
import { CommandExecutorService } from '../command/command-executor.service';

export interface ControlChannelStatus {
    state: 'disabled' | 'connecting' | 'connected' | 'disconnected' | 'error';
    lastChangeAt: string;
    lastHeartbeatAt?: string;
    lastError?: string;
    reconnectInMs?: number;
    url?: string;
    lastCommandId?: string;
    lastCommandStatus?: GatewayAckPayload['status'];
}

@Injectable()
export class ControlChannelService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ControlChannelService.name);
    private socket?: WebSocket;
    private reconnectTimer?: NodeJS.Timeout;
    private heartbeatTimer?: NodeJS.Timeout;
    private status: ControlChannelStatus = {
        state: 'disconnected',
        lastChangeAt: new Date().toISOString(),
    };

    private currentGateway?: { gatewayId: string; organizationId?: number };

    constructor(
        private readonly config: GatewayConfigService,
        private readonly buffer: GatewayBufferService,
        private readonly commandExecutor: CommandExecutorService
    ) {}

    onModuleInit(): void {
        const controlUrl = this.config.controlChannelUrl;
        if (!controlUrl) {
            this.status = {
                state: 'disabled',
                lastChangeAt: new Date().toISOString(),
            };
            this.logger.log('Control channel disabled (CONTROL_URL not configured).');
            return;
        }

        this.connect(controlUrl);
    }

    onModuleDestroy(): void {
        this.clearHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close();
        }
    }

    getStatus(): ControlChannelStatus {
        return this.status;
    }

    private connect(url: string): void {
        this.clearHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }

        this.updateStatus('connecting', { url });
        this.logger.log(`Connecting to control channel ${url}`);

        const headers: Record<string, string> = {
            'x-gateway-id': this.config.gatewayId,
        };

        if (this.config.organizationId) {
            headers['x-organization-id'] = String(this.config.organizationId);
        }

        if (this.config.apiKey) {
            headers['x-api-key'] = this.config.apiKey;
        }

        this.socket = new WebSocket(url, { headers });
        this.currentGateway = {
            gatewayId: this.config.gatewayId,
            organizationId: this.config.organizationId ?? undefined,
        };

        this.socket.on('open', () => {
            this.logger.log('Control channel connected');
            this.updateStatus('connected', { url });
            this.startHeartbeat();
        });

        this.socket.on('message', data => {
            void this.handleMessage(data);
        });

        this.socket.on('close', code => {
            this.logger.warn(`Control channel closed with code ${code}`);
            this.scheduleReconnect(url, `Closed with code ${code}`);
        });

        this.socket.on('error', error => {
            this.logger.error(`Control channel error: ${(error as Error).message}`);
            this.updateStatus('error', { lastError: (error as Error).message, url });
        });
    }

    private scheduleReconnect(url: string, reason: string): void {
        this.clearHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        const backoff = this.config.reconnectBackoffMs;
        this.updateStatus('disconnected', {
            lastError: reason,
            reconnectInMs: backoff,
            url,
        });

        this.reconnectTimer = setTimeout(() => {
            this.connect(url);
        }, backoff);
        this.reconnectTimer.unref?.();

        this.logger.log(`Scheduled control channel reconnect in ${backoff}ms`);
    }

    private startHeartbeat(): void {
        this.clearHeartbeat();
        const interval = this.config.heartbeatIntervalMs;
        this.heartbeatTimer = setInterval(() => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                return;
            }

            const heartbeat: GatewayHeartbeatPayload = {
                type: 'heartbeat',
                gatewayId: this.config.gatewayId,
                queueDepth: this.buffer.size,
                timestamp: new Date().toISOString(),
                organizationId: this.config.organizationId ?? undefined,
                metrics: {
                    bufferSize: this.buffer.size,
                },
            };

            this.sendMessage(heartbeat);
            this.updateStatus(this.status.state, { lastHeartbeatAt: heartbeat.timestamp });
        }, interval);
        this.heartbeatTimer.unref?.();

        this.logger.debug(`Control channel heartbeat started (interval: ${interval} ms)`);
    }

    private clearHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

    private async handleMessage(data: RawData): Promise<void> {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        try {
            const message = JSON.parse(String(data)) as GatewayControlInboundMessage;

            if (this.isCommandEnvelope(message)) {
                const envelope = message;
                this.logger.log(`Received command ${envelope.command.id} (${envelope.command.type})`);
                const result = await this.commandExecutor.execute(envelope);
                this.sendMessage(result.ack);
                this.updateStatus(this.status.state, {
                    lastCommandId: result.ack.commandId,
                    lastCommandStatus: result.ack.status,
                });
                return;
            }

            if (message.type === 'heartbeat') {
                const heartbeat = message;
                this.logger.debug(
                    `Control channel heartbeat echo: queueDepth=${heartbeat.queueDepth}`
                );
                return;
            }

            this.logger.debug(`Control channel message: ${JSON.stringify(message)}`);
        } catch (error) {
            this.logger.warn(`Failed to process control message: ${(error as Error).message}`);
        }
    }

    private sendMessage(payload: GatewayControlOutboundMessage): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(payload));
        }
    }

    private isCommandEnvelope(
        message: GatewayControlInboundMessage
    ): message is GatewayCommandEnvelope {
        return message.type === 'command' && 'command' in message;
    }

    private updateStatus(
        state: ControlChannelStatus['state'],
        patch: Partial<ControlChannelStatus> = {}
    ) {
        this.status = {
            ...this.status,
            ...patch,
            state,
            lastChangeAt: new Date().toISOString(),
        };
    }
}
