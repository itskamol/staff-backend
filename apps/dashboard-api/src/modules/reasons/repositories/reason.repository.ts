import { Injectable } from '@nestjs/common';
import { Prisma, Reasons } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class ReasonRepository extends BaseRepository<
    Reasons,
    Prisma.ReasonsCreateInput,
    Prisma.ReasonsUpdateInput,
    Prisma.ReasonsWhereInput,
    Prisma.ReasonsWhereUniqueInput,
    Prisma.ReasonsOrderByWithRelationInput,
    Prisma.ReasonsInclude
> {
    protected readonly modelName = 'Reasons';

    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.reasons;
    }

    getDefaultInclude(): Prisma.ReasonsInclude {
        return {
            organization: true, // Agar organization ma'lumotlari kerak bo'lsa
        };
    }
}
