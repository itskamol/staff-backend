import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GatewayConfigService {
    private readonly apiKeys: Set<string>;

    constructor(private readonly configService: ConfigService) {
        this.apiKeys = this.loadApiKeys();
    }

    isApiKeyValid(provided?: string | null): boolean {
        if (!provided) {
            return false;
        }
        const normalized = provided.trim();
        return this.apiKeys.has(normalized);
    }

    private loadApiKeys(): Set<string> {
        const raw = this.configService.get<string>('GATEWAY_API_KEYS', '');
        const keys = raw
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);

        return new Set(keys);
    }
}
