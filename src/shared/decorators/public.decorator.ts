import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark routes as public (no authentication required)
 */
export const Public = () => SetMetadata('isPublic', true);
