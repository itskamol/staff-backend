import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { UserContext } from '../interfaces/data-scope.interface';

export interface RequestWithUser {
    user: UserContext;
}

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

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
                throw new ForbiddenException(
                    `Access denied. Required roles: ${requiredRoles.join(', ')}`
                );
            }
        }

        return true;
    }
}
