export interface GatewayHeartbeatPayload {
    type: 'heartbeat';
    gatewayId: string;
    queueDepth: number;
    timestamp: string;
    organizationId?: number;
    metrics?: Record<string, unknown>;
}

export type GatewayControlInboundMessage =
    | GatewayHeartbeatPayload
    | GatewayCommandEnvelope
    | GatewayAckPayload
    | Record<string, unknown>;

export interface GatewayCommandPayload {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    requiresAck?: boolean;
}

export interface GatewayCommandEnvelope {
    type: 'command';
    command: GatewayCommandPayload;
}

export interface GatewayAckPayload {
    type: 'ack';
    commandId: string;
    status: 'accepted' | 'rejected';
    error?: string;
    timestamp: string;
}

export type GatewayControlOutboundMessage =
    | GatewayCommandEnvelope
    | GatewayAckPayload
    | GatewayHeartbeatPayload;
