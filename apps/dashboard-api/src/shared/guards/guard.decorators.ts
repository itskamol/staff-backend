import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { DataScopeGuard } from './data-scope.guard';
import { DeviceAuthGuard } from './device-auth.guard';

/**
 * Simple decorators for common guard combinations
 */

// Basic decorators
export const Public = () => SetMetadata('isPublic', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export const NoScoping = () => SetMetadata('noScoping', true);
export const RequireDevice = () => SetMetadata('requireDevice', true);

// Combined decorators
export const Protected = () => 
    applyDecorators(
        UseGuards(JwtAuthGuard, DataScopeGuard)
    );

export const WithRoles = (...roles: Role[]) =>
    applyDecorators(
        UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard),
        Roles(...roles)
    );

export const AdminOnly = () =>
    applyDecorators(
        UseGuards(JwtAuthGuard, RolesGuard),
        Roles(Role.ADMIN),
        NoScoping()
    );

export const DeviceProtected = (...roles: Role[]) => {
    const decorators = [UseGuards(DeviceAuthGuard, JwtAuthGuard, DataScopeGuard)];
    if (roles.length > 0) {
        decorators.push(UseGuards(RolesGuard), Roles(...roles));
    }
    return applyDecorators(...decorators);
};