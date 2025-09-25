import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * Decorator to specify required roles for a route
 */
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
