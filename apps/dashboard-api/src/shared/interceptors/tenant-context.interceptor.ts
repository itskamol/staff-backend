import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext, TenantContextService } from '@app/shared/database';
import { Role } from '@prisma/client';
import { RequestWithScope } from '../guards/data-scope.guard';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
    constructor(private readonly tenantContext: TenantContextService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<RequestWithScope>();
        const user = request.user;

        if (!user) {
            return next.handle();
        }

        const tenant: TenantContext = {
            role: user.role ?? Role.ADMIN,
            organizationId: user.role === Role.ADMIN ? null : user.organizationId ?? null,
            userId: Number.isNaN(Number(user.sub)) ? undefined : Number(user.sub),
        };

        return this.tenantContext.run(tenant, () => next.handle());
    }
}
