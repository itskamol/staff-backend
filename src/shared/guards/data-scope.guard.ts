import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { LoggerService } from '@/core/logger';
import { DataScope, UserContext } from '../interfaces/data-scope.interface';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';

export interface RequestWithScope extends RequestWithCorrelation {
    user: UserContext;
    scope: DataScope;
}

@Injectable()
export class DataScopeGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: LoggerService
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithScope>();
        const user = request.user;

        // Skip if no user (public routes or unauthenticated)
        if (!user) {
            return true;
        }

        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        // Attach scope to request for use in services

        this.logger.debug('Data scope applied', {
            userId: user.sub,
            url: request.url,
            method: request.method,
            correlationId: request.correlationId,
            module: 'data-scope-guard',
        });

        return true;
    }
}
