import { Injectable } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/repositories/base.repository';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';

@Injectable()
export class OrganizationRepository extends BaseRepository<
    Organization,
    Prisma.OrganizationCreateInput,
    Prisma.OrganizationUpdateInput,
    Prisma.OrganizationWhereInput,
    Prisma.OrganizationWhereUniqueInput,
    Prisma.OrganizationOrderByWithRelationInput,
    Prisma.OrganizationInclude
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Organization;

    protected getDelegate() {
        return this.prisma.organization;
    }

    async findWithScope(scope: DataScope) {
        const where: Prisma.OrganizationWhereInput = {};

        if (scope?.organizationId) {
            where.id = scope.organizationId;
        }

        return this.prisma.organization.findMany({
            where,
            include: { departments: true, employees: true, gates: true },
        });
    }
}
