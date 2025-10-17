import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Role } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private static readonly ORGANIZATION_SCOPED_MODELS: Record<string, string> = {
        Department: 'organizationId',
        Employee: 'organizationId',
        Policy: 'organizationId',
        ResourceGroup: 'organizationId',
        Resource: 'organizationId',
        User: 'organizationId',
    };
    constructor(private readonly tenantContext: TenantContextService) {
        super();

        type PrismaMiddlewareFn = (
            params: any,
            next: (params: any) => Promise<unknown>
        ) => Promise<unknown>;

        const applyTenantScope: PrismaMiddlewareFn = async (params, next) => {
            const tenant = this.tenantContext.getContext();

            if (!tenant || tenant.role === Role.ADMIN) {
                return next(params);
            }

            const scopedField = PrismaService.ORGANIZATION_SCOPED_MODELS[params.model ?? ''];
            if (!scopedField) {
                return next(params);
            }

            const organizationId = tenant.organizationId;
            if (!organizationId) {
                return next(params);
            }

            switch (params.action) {
                case 'findUnique':
                    params.action = 'findFirst';
                    params.args = params.args || {};
                    params.args.where = this.addOrganizationFilter(
                        params.args.where,
                        scopedField,
                        organizationId
                    );
                    break;
                case 'findFirst':
                case 'findMany':
                case 'count':
                case 'aggregate':
                case 'deleteMany':
                case 'updateMany': {
                    params.args = params.args || {};
                    params.args.where = this.addOrganizationFilter(
                        params.args.where,
                        scopedField,
                        organizationId
                    );
                    break;
                }
                case 'update':
                case 'delete':
                case 'upsert': {
                    params.args = params.args || {};
                    params.args.where = this.addOrganizationFilter(
                        params.args.where,
                        scopedField,
                        organizationId
                    );
                    break;
                }
                case 'create': {
                    params.args = params.args || {};
                    params.args.data = this.attachOrganizationId(
                        params.args.data,
                        scopedField,
                        organizationId
                    );
                    break;
                }
                case 'createMany': {
                    params.args = params.args || {};
                    if (Array.isArray(params.args.data)) {
                        params.args.data = params.args.data.map((item: Record<string, unknown>) =>
                            this.attachOrganizationId(item, scopedField, organizationId)
                        );
                    } else {
                        params.args.data = this.attachOrganizationId(
                            params.args.data ?? {},
                            scopedField,
                            organizationId
                        );
                    }
                    break;
                }
            }

            return next(params);
        };

        const maybeUse = (this as unknown as {
            $use?: (middleware: PrismaMiddlewareFn) => void;
        }).$use;

        if (typeof maybeUse === 'function') {
            maybeUse.call(this, applyTenantScope);
        }
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async enableShutdownHooks(app: any) {
        process.on('beforeExit', async () => {
            await app.close();
        });
    }

    private addOrganizationFilter(
        where: Record<string, unknown> | undefined,
        field: string,
        organizationId: number
    ) {
        const existingWhere = where ?? {};
        if (field in (existingWhere as Record<string, unknown>)) {
            return existingWhere;
        }

        if (Object.keys(existingWhere).length === 0) {
            return { [field]: organizationId };
        }

        return {
            AND: [existingWhere, { [field]: organizationId }],
        };
    }

    private attachOrganizationId(
        data: Record<string, unknown> | undefined,
        field: string,
        organizationId: number
    ) {
        const payload = { ...(data ?? {}) };
        if (!(field in payload)) {
            payload[field] = organizationId;
        }
        return payload;
    }
}
