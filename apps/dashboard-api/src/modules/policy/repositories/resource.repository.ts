import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Resource, Prisma, ResourceType } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class ResourceRepository extends BaseRepository<
    Resource,
    Prisma.ResourceCreateInput,
    Prisma.ResourceUpdateInput,
    Prisma.ResourceWhereInput,
    Prisma.ResourceWhereUniqueInput,
    Prisma.ResourceOrderByWithRelationInput,
    Prisma.ResourceInclude,
    Prisma.ResourceSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Resource;

    protected getDelegate() {
        return this.prisma.resource;
    }

    async findByType(type: ResourceType, include?: Prisma.ResourceInclude) {
        return this.findMany({ type }, undefined, include);
    }

    async findByValue(value: string) {
        return this.findFirst({ value });
    }

    async bulkCreate(resources: Prisma.ResourceCreateInput[]) {
        return this.prisma.resource.createMany({
            data: resources,
            skipDuplicates: true
        });
    }

    async findWithGroupCount(where?: Prisma.ResourceWhereInput) {
        return this.findMany(where, undefined, {
            _count: {
                select: {
                    resourceGroups: true
                }
            }
        });
    }
}