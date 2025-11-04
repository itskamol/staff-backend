export interface BufferEnqueueItem {
    type: string;
    occurredAt: string;
    payload: Record<string, unknown>;
    source?: string;
}

import { GatewayIngestRecord } from '@app/shared/gateway';

export interface BufferedRecord extends BufferEnqueueItem, GatewayIngestRecord {
    id: string;
    channel: string;
    enqueuedAt: string;
    attempts: number;
    context?: Record<string, unknown>;
}

export interface BufferSnapshot {
    size: number;
    capacity: number;
    storagePath: string;
    lastPersistedAt?: string;
    oldestRecordAt?: string;
    diskUsageBytes?: number;
}
