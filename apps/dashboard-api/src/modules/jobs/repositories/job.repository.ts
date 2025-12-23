import { Injectable } from '@nestjs/common';
import { Prisma, Job } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class JobRepository extends BaseRepository<
    Job,
    Prisma.JobCreateInput,
    Prisma.JobUpdateInput,
    Prisma.JobWhereInput,
    Prisma.JobWhereUniqueInput,
    Prisma.JobOrderByWithRelationInput,
    Prisma.JobInclude
> {
    protected readonly modelName = 'Job';

    protected disconnectRelations = ['employees'];

    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.job;
    }

    getDefaultInclude(): Prisma.JobInclude {
        return {
            organization: { select: { id: true, fullName: true, shortName: true } },
        };
    }
}
