import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface TenantContext {
    organizationId?: string | null;
    role: Role;
    userId?: number;
}

@Injectable()
export class TenantContextService {
    private readonly storage = new AsyncLocalStorage<TenantContext>();

    run<T>(context: TenantContext, callback: () => T): T {
        return this.storage.run(context, callback);
    }

    getContext(): TenantContext | undefined {
        return this.storage.getStore();
    }
}
