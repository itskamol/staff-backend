import { Injectable, Logger } from '@nestjs/common';
import {
    GatewayCommandEnvelope,
    GatewayCommandPayload,
    GatewayAckPayload,
} from '@app/shared/gateway';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { DeviceCommandRequest } from '../adapters/device-adapter.interface';
import { GatewayConfigService } from '../../config/gateway-config.service';

export interface CommandExecutionResult {
    ack: GatewayAckPayload;
    response?: Record<string, unknown>;
}

export interface CommandExecutorMetrics {
    processed: number;
    accepted: number;
    rejected: number;
    lastCommandId?: string;
    lastStatus?: GatewayAckPayload['status'];
    lastError?: string;
    lastExecutedAt?: string;
}

@Injectable()
export class CommandExecutorService {
    private readonly logger = new Logger(CommandExecutorService.name);
    private metrics: CommandExecutorMetrics = {
        processed: 0,
        accepted: 0,
        rejected: 0,
    };

    constructor(
        private readonly registry: AdapterRegistryService,
        private readonly config: GatewayConfigService
    ) {}

    async execute(commandEnvelope: GatewayCommandEnvelope): Promise<CommandExecutionResult> {
        const { command } = commandEnvelope;
        const timestamp = new Date().toISOString();

        let ack: GatewayAckPayload | undefined;
        let response: Record<string, unknown> | undefined;

        try {
            let response: Record<string, unknown> | undefined;

            switch (command.type) {
                case 'device.execute':
                    response = await this.handleDeviceCommand(command);
                    break;
                case 'policy.sync':
                    response = await this.handlePolicySync(command);
                    break;
                case 'gateway.restart':
                    response = await this.handleGatewayRestart(command);
                    break;
                default:
                    throw new Error(`Unsupported command type: ${command.type}`);
            }

            const successAck: GatewayAckPayload = {
                type: 'ack',
                commandId: command.id,
                status: 'accepted',
                timestamp,
            };
            ack = successAck;
            return { ack: successAck, response };
        } catch (error) {
            this.logger.error(
                `Command ${command.id} (${command.type}) failed: ${(error as Error).message}`
            );
            const failureAck: GatewayAckPayload = {
                type: 'ack',
                commandId: command.id,
                status: 'rejected',
                error: (error as Error).message,
                timestamp,
            };
            ack = failureAck;
            return { ack: failureAck };
        }
        finally {
            if (ack) {
                const prev = this.metrics;
                this.metrics = {
                    processed: prev.processed + 1,
                    accepted:
                        ack.status === 'accepted' ? prev.accepted + 1 : prev.accepted,
                    rejected:
                        ack.status === 'rejected' ? prev.rejected + 1 : prev.rejected,
                    lastCommandId: ack.commandId,
                    lastStatus: ack.status,
                    lastError: ack.error,
                    lastExecutedAt: ack.timestamp,
                };
            }
        }
    }

    getMetrics(): CommandExecutorMetrics {
        return { ...this.metrics };
    }

    private async handleDeviceCommand(command: GatewayCommandPayload) {
        const adapterType = String(command.payload?.adapterType ?? 'generic');
        const vendor = String(command.payload?.adapterVendor ?? 'logger');
        const adapter = this.registry.getAdapter(adapterType, vendor);
        if (!adapter) {
            throw new Error(`No adapter registered for ${adapterType}/${vendor}`);
        }

        const request: DeviceCommandRequest = {
            deviceId: String(command.payload?.deviceId ?? ''),
            command: String(command.payload?.command ?? ''),
            payload: (command.payload?.parameters as Record<string, unknown>) ?? {},
        };

        if (!request.deviceId) {
            throw new Error('deviceId is required for device command');
        }

        const context = {
            gatewayId: this.config.gatewayId,
            organizationId: this.config.organizationId ?? undefined,
            correlationId: command.id,
        };

        const result = await adapter.executeCommand(request, context);
        return {
            adapterType,
            vendor,
            result,
        };
    }

    private async handlePolicySync(command: GatewayCommandPayload) {
        this.logger.log(`Policy sync requested: ${JSON.stringify(command.payload)}`);
        // TODO: Trigger local policy update once implemented.
        return {
            syncedAt: new Date().toISOString(),
        };
    }

    private async handleGatewayRestart(command: GatewayCommandPayload) {
        this.logger.warn('Gateway restart command received. Simulating restart.');
        // TODO: implement safe restart procedure (systemd/service manager integration).
        return {
            restartScheduledAt: new Date().toISOString(),
            command,
        };
    }
}
