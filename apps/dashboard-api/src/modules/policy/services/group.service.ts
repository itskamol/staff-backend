import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreateGroupDto, UpdateGroupDto } from '../dto/group.dto';
import { ResourceType } from '@prisma/client';
import { UserContext } from '../../../shared/interfaces';
import { GroupRepository } from '../repositories/group.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class GroupService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly groupRepository: GroupRepository
    ) {}

    async findAll(query: QueryDto & { type: ResourceType }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, type } = query;
        const where: Prisma.GroupWhereInput = {};

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        if (type) {
            where.type = type;
        }

        return this.groupRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                _count: {
                    select: {
                        resourceGroups: true,
                        options: true
                    }
                }
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const group = await this.groupRepository.findById(id, {
            resourceGroups: {
                include: {
                    resource: true
                }
            },
            options: {
                include: {
                    policy: {
                        select: {
                            id: true,
                            title: true
                        }
                    }
                }
            },
            _count: {
                select: {
                    resourceGroups: true,
                    options: true
                }
            }
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        return group;
    }

    async create(createGroupDto: CreateGroupDto, scope: DataScope) {
        return this.groupRepository.create(createGroupDto, undefined, scope);
    }

    async update(id: number, updateGroupDto: UpdateGroupDto, user: UserContext) {
        await this.findOne(id, user);

        return this.groupRepository.update(id, updateGroupDto);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const group = await this.groupRepository.findById(id, {
            _count: {
                select: {
                    options: true
                }
            }
        }, scope);

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        if ((group as any)._count?.options > 0) {
            throw new BadRequestException('Cannot delete group that is used in policies');
        }

        return this.groupRepository.delete(id, scope);
    }

    async addResources(groupId: number, resourceIds: number[], user: UserContext) {
        await this.findOne(groupId, user);

        const existingConnections = await this.prisma.resourceGroups.findMany({
            where: {
                groupId,
                resourceId: { in: resourceIds }
            }
        });

        const existingResourceIds = existingConnections.map(conn => conn.resourceId);
        const newResourceIds = resourceIds.filter(id => !existingResourceIds.includes(id));

        if (newResourceIds.length === 0) {
            throw new BadRequestException('All resources are already in this group');
        }

        await this.prisma.resourceGroups.createMany({
            data: newResourceIds.map(resourceId => ({
                groupId,
                resourceId
            }))
        });

        return { added: newResourceIds.length };
    }

    async removeResource(groupId: number, resourceId: number, user: UserContext) {
        await this.findOne(groupId, user);

        const connection = await this.prisma.resourceGroups.findFirst({
            where: { groupId, resourceId }
        });

        if (!connection) {
            throw new NotFoundException('Resource not found in this group');
        }

        await this.prisma.resourceGroups.delete({
            where: { id: connection.id }
        });

        return { message: 'Resource removed from group' };
    }

    async findByType(type: ResourceType) {
        return this.groupRepository.findByType(type);
    }
}