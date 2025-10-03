import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreateResourceDto, UpdateResourceDto } from '../dto/resource.dto';
import { ResourceType } from '@prisma/client';
import { UserContext } from '../../../shared/interfaces';
import { ResourceRepository } from '../repositories/resource.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class ResourceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly resourceRepository: ResourceRepository
    ) {}

    async findAll(query: QueryDto & { type?: string }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, type } = query;
        const where: Prisma.ResourceWhereInput = {};

        if (search) {
            where.value = { contains: search, mode: 'insensitive' };
        }

        if (type) {
            where.type = type as ResourceType;
        }

        return this.resourceRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                _count: {
                    select: {
                        resourceGroups: true
                    }
                }
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const resource = await this.resourceRepository.findById(id, {
            resourceGroups: {
                include: {
                    group: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    resourceGroups: true
                }
            }
        });

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }

        return resource;
    }

    async create(createResourceDto: CreateResourceDto, scope: DataScope) {
        // Check if resource with same value already exists
        const existing = await this.resourceRepository.findByValue(createResourceDto.value);
        if (existing) {
            throw new BadRequestException('Resource with this value already exists');
        }

        return this.resourceRepository.create(createResourceDto, undefined, scope);
    }

    async update(id: number, updateResourceDto: UpdateResourceDto, user: UserContext) {
        await this.findOne(id, user);

        // Check if updating to existing value
        if (updateResourceDto.value) {
            const existing = await this.resourceRepository.findByValue(updateResourceDto.value);
            if (existing && existing.id !== id) {
                throw new BadRequestException('Resource with this value already exists');
            }
        }

        return this.resourceRepository.update(id, updateResourceDto);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const resource = await this.resourceRepository.findById(id, {
            _count: {
                select: {
                    resourceGroups: true
                }
            }
        }, scope);

        if (!resource) {
            throw new NotFoundException('Resource not found');
        }

        if ((resource as any)._count?.resourceGroups > 0) {
            throw new BadRequestException('Cannot delete resource that is used in groups');
        }

        return this.resourceRepository.delete(id, scope);
    }

    async findByType(type: ResourceType) {
        return this.resourceRepository.findByType(type);
    }

    async bulkCreate(resources: CreateResourceDto[], scope: DataScope) {
        // Filter out duplicates
        const uniqueResources = resources.filter((resource, index, self) => 
            index === self.findIndex(r => r.value === resource.value)
        );

        // Check for existing resources
        const existingResources = await this.prisma.resource.findMany({
            where: {
                value: { in: uniqueResources.map(r => r.value) }
            }
        });

        const existingValues = existingResources.map(r => r.value);
        const newResources = uniqueResources.filter(r => !existingValues.includes(r.value));

        if (newResources.length === 0) {
            throw new BadRequestException('All resources already exist');
        }

        const result = await this.resourceRepository.bulkCreate(newResources);
        return { created: result.count, skipped: resources.length - result.count };
    }
}