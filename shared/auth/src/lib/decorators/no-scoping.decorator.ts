import { SetMetadata } from '@nestjs/common';

export const NO_SCOPING_KEY = 'noScoping';
export const NoScoping = () => SetMetadata(NO_SCOPING_KEY, true);
