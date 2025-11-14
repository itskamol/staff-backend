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

    async findByPolicyId(policyId: string, include?: Prisma.PolicyOptionInclude) {
        return this.findMany({ policyId }, undefined, include);
    }

    async findByGroupId(groupId: string, include?: Prisma.PolicyOptionInclude) {
        return this.findMany({}, undefined, include);
    }

    async findByPolicyAndGroup(policyId: string) {
        return this.findFirst({ policyId });
    }

    async deleteByPolicyId(policyId: string) {
        return this.deleteMany({ policyId });
    }

    async deleteByGroupId(groupId: string) {
        return this.deleteByPolicyId(groupId);
    }
}
