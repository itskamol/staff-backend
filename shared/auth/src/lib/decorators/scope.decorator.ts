import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { DataScope } from '../interfaces/data-scope.interface';

/**
 * Decorator to extract data scope from request
 */
export const Scope = createParamDecorator(
    (data: keyof DataScope | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();

        const scope =
            request.dataScope ??
            ({
                organizationId: request.user?.organizationId,
                departmentIds: request.user?.departmentIds,
            } as DataScope);

        return data ? scope?.[data] : scope;
    }
);
