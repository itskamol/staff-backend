import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { UserContext } from '../interfaces/data-scope.interface';
import { LoggerService } from '../../core/logger';

export interface RequestWithUser {
    user: UserContext;
    url: string;
    method: string;
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly logger: LoggerService
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const user = request.user;

        if (!user) return true;

        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const requiredRoles = this.reflector.getAllAndMerge<Role[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (requiredRoles && requiredRoles.length > 0) {
            const hasRole = requiredRoles.includes(user.role);

            if (!hasRole) {
                this.logger.warn('Role access denied', {
                    userId: user.sub,
                    userRole: user.role,
                    requiredRoles,
                    url: request.url,
                    method: request.method,
                });
                
                throw new ForbiddenException(
                    `Access denied. Required roles: ${requiredRoles.join(', ')}, your role: ${user.role}`
                );
            }

            this.logger.debug('Role check passed', {
                userId: user.sub,
                userRole: user.role,
                requiredRoles,
            });
        }

        return true;
    }
}
