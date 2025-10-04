import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataScope } from '../interfaces/data-scope.interface';
import { Role } from '@prisma/client';


@Injectable()
export class DataScopeGuard implements CanActivate {
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) return true;

        const noScoping = this.reflector.getAllAndOverride<boolean>('noScoping', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (noScoping) return true;

        const request = context.switchToHttp().getRequest();
        const { user } = request;

        if (!user) {
            return false;
        }

        // Admin has access to everything
        if (user.role === Role.ADMIN) {
            return true;
        }

        // Apply data scoping based on role
        const scope: DataScope = {
            organizationId: user.organizationId,
            departments: [],
        };

        switch (user.role) {
            case Role.HR:
                // HR scope limited to their organization
                scope.organizationId = user.organizationId;
                break;
            case Role.DEPARTMENT_LEAD:
                // Department lead scope limited to their departments
                scope.organizationId = user.organizationId;
                scope.departments = user.departmentIds || [];
                break;
            case Role.GUARD:
                // Guard has limited scope for entry/exit monitoring
                scope.organizationId = user.organizationId;
                break;
        }

        // Attach scope to request for use in services
        request.dataScope = scope;
        return true;
    }
}
