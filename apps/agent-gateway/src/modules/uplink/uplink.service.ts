import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GatewayConfigService } from '../../config/gateway-config.service';
import { GatewayBufferService } from '../buffer/gateway-buffer.service';
import { BufferedRecord } from '../buffer/interfaces';
import { GatewayIngestBatchRequest, GatewayIngestBatchResponse } from '@app/shared/gateway';

export interface UplinkStatus {
    state: 'disabled' | 'idle' | 'success' | 'error';
    reason?: string;
    lastAttemptAt?: string;
    lastSuccessAt?: string;
    lastError?: string;
    lastBatchSize?: number;
    queueDepth: number;
}

@Injectable()
export class UplinkService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(UplinkService.name);
    private flushTimer?: NodeJS.Timeout;
    private status: UplinkStatus = { state: 'idle', queueDepth: 0 };
    private isFlushing = false;

    constructor(
        private readonly buffer: GatewayBufferService,
        private readonly config: GatewayConfigService
    ) {}

    onModuleInit(): void {
        const baseUrl = this.config.agentApiUrl;
        if (!baseUrl) {
            this.status = {
                state: 'disabled',
                reason: 'SERVER_URL is not configured',
                queueDepth: this.buffer.size,
            };
            this.logger.warn('Agent API URL is not configured. Uplink disabled.');
            return;
        }

        if (!this.config.apiKey) {
            this.logger.warn('API_KEY is not configured. Requests may be rejected by the server.');
        }

        this.registerFlushTimer();
    }

    onModuleDestroy(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
    }

    getStatus(): UplinkStatus {
        return {
            ...this.status,
            queueDepth: this.buffer.size,
        };
    }

    async flush(force = false): Promise<void> {
        if (this.status.state === 'disabled') {
            return;
        }

        if (this.isFlushing) {
            this.logger.debug('Flush skipped because a previous cycle is still running');
            return;
        }

        this.isFlushing = true;
        const startedAt = new Date();
        const batchSize = this.config.maxBatchSize;
        let batch: BufferedRecord[] = [];

        try {
            batch = await this.buffer.drain(batchSize);
            if (!batch.length) {
                if (force) {
                    this.status = {
                        state: 'idle',
                        queueDepth: this.buffer.size,
                        lastAttemptAt: startedAt.toISOString(),
                        reason: 'No buffered records to send',
                    };
                }
                return;
            }

            const response = await this.dispatchBatch(batch);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Upstream responded with ${response.status} ${response.statusText}: ${errorText}`
                );
            }

            const now = new Date().toISOString();
            this.status = {
                state: 'success',
                lastAttemptAt: startedAt.toISOString(),
                lastSuccessAt: now,
                lastBatchSize: batch.length,
                queueDepth: this.buffer.size,
            };
            this.logger.debug(`Successfully flushed ${batch.length} record(s) upstream.`);
        } catch (error) {
            await this.buffer.requeue(batch);
            this.status = {
                state: 'error',
                lastAttemptAt: startedAt.toISOString(),
                lastError: (error as Error).message,
                queueDepth: this.buffer.size,
                lastBatchSize: batch.length || undefined,
            };
            this.logger.error(`Failed to flush telemetry: ${(error as Error).message}`);
        } finally {
            this.isFlushing = false;
        }
    }

    private registerFlushTimer(): void {
        const intervalMs = this.config.flushIntervalMs;
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, intervalMs);
        this.flushTimer.unref?.();

        this.logger.log(`Uplink flush timer registered (interval: ${intervalMs} ms)`);
    }

    private async dispatchBatch(batch: BufferedRecord[]): Promise<Response> {
        const baseUrl = this.config.agentApiUrl!;
        const endpoint = `${baseUrl}/api/gateway/ingest`;
        const payload: GatewayIngestBatchRequest = {
            gatewayId: this.config.gatewayId,
            organizationId: this.config.organizationId ?? undefined,
            records: batch,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(this.config.apiKey ? { 'x-api-key': this.config.apiKey } : {}),
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            try {
                const body = (await response.json()) as { data?: GatewayIngestBatchResponse };
                if (body?.data?.queueDepth !== undefined) {
                    this.status.queueDepth = body.data.queueDepth;
                }
            } catch (error) {
                this.logger.debug(
                    `Failed to parse ingest response payload: ${(error as Error).message}`
                );
            }
        }

        return response;
    }
}
