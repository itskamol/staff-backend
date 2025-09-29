import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { DataScope, UserContext } from '../interfaces/data-scope.interface';
import { Role } from '@prisma/client';
import { LoggerService } from '../../core/logger';

export interface RequestWithScope extends Request {
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

        const noScoping = this.reflector.getAllAndOverride<boolean>('noScoping', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (noScoping) {
            if (user.role !== Role.ADMIN) {
                this.logger.logUserAction(+user.sub, 'DATA_SCOPE_VIOLATION_NO_SCOPING', {
                    userId: user.sub,
                    role: user.role,
                    url: request.url,
                    method: request.method,
                    organizationId: user.organizationId,
                });
                throw new ForbiddenException('Insufficient privileges for system-wide access');
            }
            return true;
        }

        if (!user.organizationId && user.role !== Role.ADMIN) {
            this.logger.logUserAction(+user.sub, 'DATA_SCOPE_VIOLATION_NO_ORGANIZATION', {
                userId: user.sub,
                role: user.role,
                url: request.url,
                method: request.method,
            });
            throw new ForbiddenException('No organization context available');
        }

        const scope: DataScope = {
            organizationId: user.organizationId,
            departments: user?.departments,
        };

        // Attach scope to request for use in services
        request.scope = scope;

        this.logger.debug('Data scope applied', {
            userId: user.sub,
            organizationId: scope.organizationId,
            departments: scope.departments,
            url: request.url,
            method: request.method,
            module: 'data-scope-guard',
        });

        return true;
    }
}
