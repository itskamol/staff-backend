import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { LoggerService } from '../../core/logger';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: LoggerService
    ) {
        super();
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest(err: Error, user: any, info: any, context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();

        if (err || !user) {
            const errorMessage = err?.message || info?.message || 'Authentication failed';

            this.logger.logUserAction(undefined, 'JWT_AUTH_FAILED', {
                error: errorMessage,
                url: request.url,
                method: request.method,
                userAgent: request.headers['user-agent'],
                ip: request.ip,
            });

            throw err || new UnauthorizedException(errorMessage);
        }

        // Log successful authentication
        this.logger.debug('JWT authentication successful', {
            userId: user.sub,
            organizationId: user.organizationId,
            roles: user.roles,
            url: request.url,
            method: request.method,
            correlationId: request.correlationId,
            module: 'jwt-auth-guard',
        });

        return user;
    }
}
