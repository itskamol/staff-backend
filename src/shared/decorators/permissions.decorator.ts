import { SetMetadata } from '@nestjs/common';
import { Permission } from '@/shared/constants/permissions.constants';

/**
 * Decorator to specify required permissions for a route
 * @param permissions - Array of permission strings from PERMISSIONS constants
 */
export const Permissions = (...permissions: (Permission | string)[]) =>
    SetMetadata('permissions', permissions);
