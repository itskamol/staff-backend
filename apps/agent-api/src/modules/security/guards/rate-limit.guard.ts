import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityService } from '../security.service';
import { RateLimitConfigDto } from '../dto/security.dto';

export const RATE_LIMIT_KEY = 'rateLimit';
export const RateLimit = (config: RateLimitConfigDto) => {
    const { SetMetadata } = require('@nestjs/common');
    return SetMetadata(RATE_LIMIT_KEY, config);
};

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Get rate limit configuration from decorator
        const rateLimitConfig = this.reflector.getAllAndOverride<RateLimitConfigDto>(
            RATE_LIMIT_KEY,
            [context.getHandler(), context.getClass()]
        );

        // Skip if no rate limit is configured
        if (!rateLimitConfig) {
            return true;
        }

        const ipAddress = this.getClientIp(request);
        const userAgent = request.headers['user-agent'] || 'Unknown';
        const identifier = `ip:${ipAddress}`;

        const rateLimitPassed = await this.securityService.checkRateLimit(
            identifier,
            ipAddress,
            userAgent,
            rateLimitConfig
        );

        // Set rate limit headers
        response.setHeader('X-RateLimit-Limit', rateLimitConfig.maxRequests);
        response.setHeader('X-RateLimit-Window', rateLimitConfig.windowSeconds);
        response.setHeader('X-RateLimit-Reset', Date.now() + rateLimitConfig.windowSeconds * 1000);

        if (!rateLimitPassed) {
            response.setHeader('X-RateLimit-Remaining', 0);
            response.setHeader('Retry-After', rateLimitConfig.blockDurationSeconds || 300);
            throw new ForbiddenException('Rate limit exceeded');
        }

        return true;
    }

    private getClientIp(request: any): string {
        return (
            request.headers['x-forwarded-for']?.split(',')[0] ||
            request.headers['x-real-ip'] ||
            request.connection?.remoteAddress ||
            request.socket?.remoteAddress ||
            request.ip ||
            'unknown'
        );
    }
}
