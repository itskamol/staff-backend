import { Injectable } from '@nestjs/common';
import { Prisma, Action } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class ActionRepository extends BaseRepository<
    Action,
    Prisma.ActionCreateInput,
    Prisma.ActionUpdateInput,
    Prisma.ActionWhereInput,
    Prisma.ActionWhereUniqueInput,
    Prisma.ActionOrderByWithRelationInput,
    Prisma.ActionInclude
> {
    protected readonly modelName = 'Action';

    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.action;
    }

    getDefaultInclude(): Prisma.ActionInclude {
        return {
            employee: {
                select: {
                    id: true,
                    name: true,
                    photo: true,
                    phone: true,
                },
            },
            credential: {
                select: {
                    id: true,
                    code: true,
                    type: true,
                },
            },
        };
    }
}
