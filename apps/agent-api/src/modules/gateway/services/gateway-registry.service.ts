import { Injectable } from '@nestjs/common';
import { GatewayHeartbeatPayload } from '@app/shared/gateway';

export interface GatewayStatusSnapshot {
    gatewayId: string;
    organizationId?: number;
    lastHeartbeatAt?: string;
    queueDepth?: number;
    state: 'connected' | 'disconnected';
    lastSeenAt?: string;
    metadata?: Record<string, unknown>;
}

@Injectable()
export class GatewayRegistryService {
    private readonly statusByGateway = new Map<string, GatewayStatusSnapshot>();

    updateHeartbeat(heartbeat: GatewayHeartbeatPayload): GatewayStatusSnapshot {
        const snapshot: GatewayStatusSnapshot = {
            gatewayId: heartbeat.gatewayId,
            organizationId: heartbeat.organizationId,
            lastHeartbeatAt: heartbeat.timestamp,
            queueDepth: heartbeat.queueDepth,
            metadata: heartbeat.metrics,
            lastSeenAt: new Date().toISOString(),
            state: 'connected',
        };

        this.statusByGateway.set(heartbeat.gatewayId, snapshot);
        return snapshot;
    }

    markDisconnected(gatewayId: string): void {
        const existing = this.statusByGateway.get(gatewayId);
        if (!existing) {
            return;
        }

        this.statusByGateway.set(gatewayId, {
            ...existing,
            state: 'disconnected',
            lastSeenAt: new Date().toISOString(),
        });
    }

    getStatus(gatewayId: string): GatewayStatusSnapshot | undefined {
        return this.statusByGateway.get(gatewayId);
    }
}
