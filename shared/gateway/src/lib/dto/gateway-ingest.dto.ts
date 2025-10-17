export interface GatewayIngestRecord {
    id?: string;
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    source?: string;
    attempts?: number;
    enqueuedAt?: string;
    channel?: string;
    context?: Record<string, unknown>;
}

export interface GatewayIngestBatchRequest {
    gatewayId: string;
    organizationId?: number;
    records: GatewayIngestRecord[];
}

export interface GatewayIngestBatchResponse {
    accepted: number;
    rejected?: number;
    message?: string;
    queueDepth?: number;
    processedAt: string;
}
