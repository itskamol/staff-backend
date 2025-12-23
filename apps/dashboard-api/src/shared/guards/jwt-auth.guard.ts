import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { LoggerService } from '../../core/logger';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector, private readonly logger: LoggerService) {
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

    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();

        if (err || !user) {
            let message = 'Unauthorized';

            if (info?.message === 'No auth token') {
                message = 'Access token is missing';
            } else if (info?.name === 'TokenExpiredError') {
                message = 'Access token has expired';
            } else if (info?.name === 'JsonWebTokenError') {
                message = 'Access token is invalid';
            } else if (info?.message) {
                message = info.message;
            }

            this.logger.logUserAction(undefined, 'JWT_AUTH_FAILED', {
                error: info?.message || err?.message,
                url: request.url,
                method: request.method,
                userAgent: request.headers['user-agent'],
                ip: request.ip,
            });

            throw new UnauthorizedException(message);
        }

        return user;
    }
}
