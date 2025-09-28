import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
    ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityService } from '../security.service';
import { ApiKeyType } from '../dto/security.dto';

export const API_KEY_TYPES_KEY = 'apiKeyTypes';
export const ApiKeyTypes = (...types: ApiKeyType[]) => {
    const { SetMetadata } = require('@nestjs/common');
    return SetMetadata(API_KEY_TYPES_KEY, types);
};

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Get required API key types from decorator
        const requiredTypes = this.reflector.getAllAndOverride<ApiKeyType[]>(API_KEY_TYPES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // Extract API key from headers
        const apiKey = this.extractApiKey(request);
        if (!apiKey) {
            throw new UnauthorizedException('API key is required');
        }

        // Get client information
        const ipAddress = this.getClientIp(request);
        const userAgent = request.headers['user-agent'] || 'Unknown';

        try {
            // Check if IP is blocked
            if (await this.securityService.isIpBlocked(ipAddress)) {
                throw new ForbiddenException('IP address is blocked');
            }

            // Validate API key
            const keyInfo = await this.securityService.validateApiKey(apiKey, ipAddress, userAgent);

            // Check if API key type is allowed
            if (requiredTypes && requiredTypes.length > 0) {
                if (!requiredTypes.includes(keyInfo.type)) {
                    throw new ForbiddenException(
                        `API key type ${keyInfo.type} is not allowed for this endpoint`
                    );
                }
            }

            // Check rate limit
            const rateLimitKey = `${apiKey}:${ipAddress}`;
            const customLimit = keyInfo.rateLimit
                ? {
                      maxRequests: keyInfo.rateLimit,
                      windowSeconds: 60,
                      burstAllowance: Math.floor(keyInfo.rateLimit * 0.1),
                      blockDurationSeconds: 300,
                  }
                : undefined;

            const rateLimitPassed = await this.securityService.checkRateLimit(
                rateLimitKey,
                ipAddress,
                userAgent,
                customLimit
            );

            if (!rateLimitPassed) {
                // Set rate limit headers
                response.setHeader('X-RateLimit-Limit', customLimit?.maxRequests || 100);
                response.setHeader('X-RateLimit-Remaining', 0);
                response.setHeader(
                    'X-RateLimit-Reset',
                    Date.now() + (customLimit?.windowSeconds || 60) * 1000
                );

                throw new ForbiddenException('Rate limit exceeded');
            }

            // Add API key info to request for use in controllers
            request.apiKeyInfo = keyInfo;
            request.clientIp = ipAddress;

            // Set rate limit headers for successful requests
            response.setHeader('X-RateLimit-Limit', customLimit?.maxRequests || 100);
            response.setHeader('X-RateLimit-Remaining', (customLimit?.maxRequests || 100) - 1);

            return true;
        } catch (error) {
            // Log security event for any authentication failure
            await this.securityService.logSecurityEvent({
                eventType: error.message.includes('rate limit')
                    ? ('RATE_LIMIT_EXCEEDED' as any)
                    : ('UNAUTHORIZED_ACCESS' as any),
                ipAddress,
                userAgent,
                apiKey,
                requestPath: request.path,
                requestMethod: request.method,
                severity: 6,
                details: { error: error.message },
            });

            throw error;
        }
    }

    private extractApiKey(request: any): string | null {
        // Check Authorization header (Bearer token)
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check X-API-Key header
        const apiKeyHeader = request.headers['x-api-key'];
        if (apiKeyHeader) {
            return apiKeyHeader;
        }

        // Check query parameter
        const apiKeyQuery = request.query.apiKey || request.query.api_key;
        if (apiKeyQuery) {
            return apiKeyQuery;
        }

        return null;
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
