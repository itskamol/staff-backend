import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SecurityService } from '../security.service';

export const REQUIRE_IP_WHITELIST_KEY = 'requireIpWhitelist';
export const RequireIpWhitelist = () => {
    const { SetMetadata } = require('@nestjs/common');
    return SetMetadata(REQUIRE_IP_WHITELIST_KEY, true);
};

@Injectable()
export class IpWhitelistGuard implements CanActivate {
    constructor(
        private readonly securityService: SecurityService,
        private readonly reflector: Reflector
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requireWhitelist = this.reflector.getAllAndOverride<boolean>(
            REQUIRE_IP_WHITELIST_KEY,
            [context.getHandler(), context.getClass()]
        );

        // Skip if IP whitelist is not required
        if (!requireWhitelist) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const ipAddress = this.getClientIp(request);
        const userAgent = request.headers['user-agent'] || 'Unknown';

        // Check if IP is blocked first
        if (await this.securityService.isIpBlocked(ipAddress)) {
            await this.securityService.logSecurityEvent({
                eventType: 'IP_BLOCKED' as any,
                ipAddress,
                userAgent,
                requestPath: request.path,
                requestMethod: request.method,
                severity: 8,
                details: { reason: 'IP is in blocked list' },
            });
            throw new ForbiddenException('IP address is blocked');
        }

        // Check if IP is in whitelist
        const isWhitelisted = await this.securityService.checkIpWhitelist(ipAddress);

        if (!isWhitelisted) {
            await this.securityService.logSecurityEvent({
                eventType: 'UNAUTHORIZED_ACCESS' as any,
                ipAddress,
                userAgent,
                requestPath: request.path,
                requestMethod: request.method,
                severity: 7,
                details: { reason: 'IP not in whitelist' },
            });
            throw new ForbiddenException('IP address not whitelisted');
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
