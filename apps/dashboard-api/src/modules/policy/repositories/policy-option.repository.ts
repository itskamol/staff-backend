import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { PolicyOption, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class PolicyOptionRepository extends BaseRepository<
    PolicyOption,
    Prisma.PolicyOptionCreateInput,
    Prisma.PolicyOptionUpdateInput,
    Prisma.PolicyOptionWhereInput,
    Prisma.PolicyOptionWhereUniqueInput,
    Prisma.PolicyOptionOrderByWithRelationInput,
    Prisma.PolicyOptionInclude,
    Prisma.PolicyOptionSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.PolicyOption;

    protected getDelegate() {
        return this.prisma.policyOption;
    }

    async findByPolicyId(policyId: number, include?: Prisma.PolicyOptionInclude) {
        return this.findMany({ policyId }, undefined, include);
    }

    async findByGroupId(groupId: number, include?: Prisma.PolicyOptionInclude) {
        return this.findMany({ groupId }, undefined, include);
    }

    async findByPolicyAndGroup(policyId: number, groupId: number) {
        return this.findFirst({ policyId, groupId });
    }

    async deleteByPolicyId(policyId: number) {
        return this.deleteMany({ policyId });
    }

    async deleteByGroupId(groupId: number) {
        return this.deleteMany({ groupId });
    }
}