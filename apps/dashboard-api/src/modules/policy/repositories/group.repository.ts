import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Group, Prisma, ResourceType } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class GroupRepository extends BaseRepository<
    Group,
    Prisma.GroupCreateInput,
    Prisma.GroupUpdateInput,
    Prisma.GroupWhereInput,
    Prisma.GroupWhereUniqueInput,
    Prisma.GroupOrderByWithRelationInput,
    Prisma.GroupInclude,
    Prisma.GroupSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Group;

    protected getDelegate() {
        return this.prisma.group;
    }

    async findByType(type: ResourceType, include?: Prisma.GroupInclude) {
        return this.findMany({ type }, undefined, include);
    }

    async findWithResourceCount(where?: Prisma.GroupWhereInput) {
        return this.findMany(where, undefined, {
            _count: {
                select: {
                    resourceGroups: true,
                    options: true
                }
            }
        });
    }
}