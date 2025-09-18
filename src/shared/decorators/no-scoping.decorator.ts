import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark routes as requiring no organization scoping (SUPER_ADMIN only)
 */
export const NoScoping = () => SetMetadata('noScoping', true);
