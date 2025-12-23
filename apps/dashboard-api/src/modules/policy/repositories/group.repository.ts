import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { ResourceGroup, Prisma, ResourceType } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class GroupRepository extends BaseRepository<
    ResourceGroup,
    Prisma.ResourceGroupCreateInput,
    Prisma.ResourceGroupUpdateInput,
    Prisma.ResourceGroupWhereInput,
    Prisma.ResourceGroupWhereUniqueInput,
    Prisma.ResourceGroupOrderByWithRelationInput,
    Prisma.ResourceGroupInclude,
    Prisma.ResourceGroupSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.ResourceGroup;

    protected cascadeRelations = ['resourcesOnGroups', 'policyRule'];

    protected disconnectRelations = [];

    protected getDelegate() {
        return this.prisma.resourceGroup;
    }

    async findByType(type: ResourceType, include?: Prisma.ResourceGroupInclude) {
        return this.findMany({ type }, undefined, include);
    }

    async findWithResourceCount(where?: Prisma.ResourceGroupWhereInput) {
        return this.findMany(where, undefined, {
            _count: {
                select: {
                    policyRules: true,
                    resources: true,
                },
            },
        });
    }
}
