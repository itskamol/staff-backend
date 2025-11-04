import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super();
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async setTenantContext(organizationId: number, role: string) {
        // Use `.$executeRawUnsafe` because template string methods do not support function calls like `set_config`.
        // The values are properly parameterized, so this is safe.
        await this.$executeRawUnsafe(
            `SELECT set_config('app.current_organization_id', $1, true)`,
            organizationId.toString()
        );
        await this.$executeRawUnsafe(
            `SELECT set_config('app.current_role', $1, true)`,
            role
        );
    }

    async enableShutdownHooks(app: any) {
        process.on('beforeExit', async () => {
            await app.close();
        });
    }
}
