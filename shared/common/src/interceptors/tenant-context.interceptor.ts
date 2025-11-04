import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { UserContext } from '@app/shared/auth';
import { PrismaService } from '@app/shared/database';
import { Role } from '@prisma/client';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
    constructor(private readonly prisma: PrismaService) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const request = context.switchToHttp().getRequest();
        const user: UserContext | undefined = request.user;

        // Set tenant context only if user is authenticated and has an organizationId
        if (user && user.organizationId && user.role !== Role.ADMIN) {
            await this.prisma.setTenantContext(user.organizationId, user.role);
        }

        return next.handle();
    }
}