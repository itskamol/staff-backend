import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'node:os';
import * as path from 'node:path';

@Injectable()
export class GatewayConfigService {
    private readonly logger = new Logger(GatewayConfigService.name);

    constructor(private readonly configService: ConfigService) {}

    get gatewayId(): string {
        return (
            this.configService.get<string>('GATEWAY_ID') ??
            this.configService.get<string>('GATEWAY_SERIAL') ??
            os.hostname()
        );
    }

    get organizationId(): number | undefined {
        const raw = this.configService.get<string>('ORGANIZATION_ID');
        if (!raw) return undefined;
        const parsed = Number(raw);
        if (Number.isNaN(parsed)) {
            this.logger.warn(`Invalid ORGANIZATION_ID provided: "${raw}"`);
            return undefined;
        }
        return parsed;
    }

    get agentApiUrl(): string | undefined {
        return this.normalizeUrl(this.configService.get<string>('SERVER_URL'));
    }

    get controlChannelUrl(): string | undefined {
        return this.normalizeUrl(
            this.configService.get<string>('CONTROL_URL') ??
                this.configService.get<string>('CONTROL_CHANNEL_URL')
        );
    }

    get apiKey(): string | undefined {
        return this.configService.get<string>('API_KEY')?.trim() || undefined;
    }

    get bufferDirectory(): string {
        const configured = this.configService.get<string>(
            'LOCAL_BUFFER_PATH',
            './tmp/agent-gateway-buffer'
        );
        return path.resolve(process.cwd(), configured);
    }

    get flushIntervalMs(): number {
        return this.getNumber('FLUSH_INTERVAL_MS', 5000);
    }

    get heartbeatIntervalMs(): number {
        return this.getNumber('HEARTBEAT_INTERVAL_MS', 15000);
    }

    get reconnectBackoffMs(): number {
        return this.getNumber('CONTROL_RECONNECT_BACKOFF_MS', 5000);
    }

    get maxBatchSize(): number {
        return this.getNumber('BATCH_SIZE', 50);
    }

    get maxQueueSize(): number {
        return this.getNumber('MAX_QUEUE_SIZE', 5000);
    }

    get metricsIntervalMs(): number {
        return this.getNumber('METRICS_INTERVAL_MS', 60000);
    }

    private getNumber(envKey: string, fallback: number): number {
        const raw = this.configService.get<string>(envKey);
        if (!raw) {
            return fallback;
        }

        const parsed = Number(raw);
        if (Number.isNaN(parsed) || parsed <= 0) {
            this.logger.warn(
                `Invalid numeric value "${raw}" received for ${envKey}. Falling back to ${fallback}.`
            );
            return fallback;
        }
        return parsed;
    }

    private normalizeUrl(url?: string | null): string | undefined {
        if (!url) return undefined;
        const trimmed = url.trim();
        if (!trimmed) return undefined;
        if (trimmed.endsWith('/')) {
            return trimmed.slice(0, -1);
        }
        return trimmed;
    }
}
