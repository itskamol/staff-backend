import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserContext } from '../interfaces/data-scope.interface';

export const getUserFromContext = (
    data: keyof UserContext | undefined,
    ctx: ExecutionContext
): UserContext | any => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserContext;

    return data ? user?.[data] : user;
};

/**
 * Decorator to extract user context from request
 */
export const User = createParamDecorator(getUserFromContext);
