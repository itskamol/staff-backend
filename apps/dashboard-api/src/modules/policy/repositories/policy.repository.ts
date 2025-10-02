import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Policy, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class PolicyRepository extends BaseRepository<
    Policy,
    Prisma.PolicyCreateInput,
    Prisma.PolicyUpdateInput,
    Prisma.PolicyWhereInput,
    Prisma.PolicyWhereUniqueInput,
    Prisma.PolicyOrderByWithRelationInput,
    Prisma.PolicyInclude,
    Prisma.PolicySelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Policy;

    protected getDelegate() {
        return this.prisma.policy;
    }
}
