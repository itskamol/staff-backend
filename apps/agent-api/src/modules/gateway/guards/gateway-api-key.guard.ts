import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GatewayConfigService } from '../services/gateway-config.service';

@Injectable()
export class GatewayApiKeyGuard implements CanActivate {
    private static readonly HEADER_NAME = 'x-api-key';

    constructor(private readonly config: GatewayConfigService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        const apiKey =
            request?.headers?.[GatewayApiKeyGuard.HEADER_NAME] ??
            request?.headers?.['X-API-Key'] ??
            request?.headers?.['X-Api-Key'];

        if (typeof apiKey === 'string' && this.config.isApiKeyValid(apiKey)) {
            return true;
        }

        if (Array.isArray(apiKey)) {
            for (const key of apiKey) {
                if (this.config.isApiKeyValid(key)) {
                    return true;
                }
            }
        }

        throw new UnauthorizedException('Invalid gateway API key');
    }
}
