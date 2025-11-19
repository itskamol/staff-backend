import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserContext } from '@app/shared/auth';
import { PrismaService, TenantContext, TenantContextService } from '@app/shared/database';
import { Role } from '@prisma/client';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
    constructor(
        private readonly prisma: PrismaService,
        private readonly tenantContext: TenantContextService,
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler<unknown>): Promise<Observable<unknown>> {
        const request = context.switchToHttp().getRequest();
        const user: UserContext | undefined = request.user;

        if (!user) {
            return next.handle();
        }

        const isAdmin = user.role === Role.ADMIN;
        const organizationId = user.organizationId ?? null;

        // Set tenant context only if user is authenticated and has an organizationId
        if (!isAdmin && organizationId) {
            await this.prisma.setTenantContext(organizationId, user.role);
        }

        const tenantContext: TenantContext = {
            role: user.role,
            organizationId: isAdmin ? null : organizationId,
            userId: Number.isNaN(Number(user.sub)) ? undefined : Number(user.sub),
        };

        return this.tenantContext.run(tenantContext, () => next.handle());
    }
}