import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { CreateGroupDto, GroupQueryDto, UpdateGroupDto } from '../dto/group.dto';
import { ResourceType, Prisma } from '@prisma/client';
import { UserContext } from '../../../shared/interfaces';
import { GroupRepository } from '../repositories/group.repository';

@Injectable()
export class GroupService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly groupRepository: GroupRepository
    ) {}

    async findAll(query: GroupQueryDto, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, type } = query;
        const where: Prisma.ResourceGroupWhereInput = {};

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
                        resources: true,
                    },
                },
            },
            { page, limit },
            undefined
        );
    }

    async findOne(id: number, user: UserContext) {
        const group = await this.groupRepository.findById(id, {
            resources: {
                select: {
                    id: true,
                    type: true,
                    value: true,
                },
            },
        });

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        return group;
    }

    async create(createGroupDto: CreateGroupDto, scope: DataScope) {
        const { resources, resourceIds, organizationId = scope?.organizationId } = createGroupDto;

        if (!organizationId) throw new BadRequestException('Organization ID is required');

        const input: Prisma.ResourceGroupCreateInput = {
            name: createGroupDto.name,
            type: createGroupDto.type,
            isActive: createGroupDto.isActive,
            organization: {
                connect: { id: organizationId },
            },
        };

        // if (resourceIds && resourceIds.length > 0) {
        //     input.resources = {
        //         connect: {

        //         },
        //     };
        // }

        if (resources && resources.length > 0) {
            input.resources = {
                create: resources.map(res => ({
                    type: ResourceType.WEBSITE,
                    value: res,
                    organization: {
                        connect: { id: organizationId },
                    },
                })),
            };
        }

        return this.groupRepository.create(input, undefined, scope);
    }

    async update(id: number, { resources, ...updateGroupDto }: UpdateGroupDto, user: UserContext) {
        await this.findOne(id, user);

        return this.groupRepository.update(id, {
            ...updateGroupDto,
        });
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const group = await this.groupRepository.findById(id, undefined, scope);

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

        const existingConnections = await this.prisma.resourceGroup.findMany({
            where: {
                id: groupId,
                resources: { some: { id: { in: resourceIds } } },
            },
            select: {
                resources: { select: { id: true } },
            },
        });

        const existingResourceIds = existingConnections
            .map(conn => conn.resources)
            .flat()
            .map(r => r.id);
        const newResourceIds = resourceIds.filter(id => !existingResourceIds.includes(id));

        if (newResourceIds.length === 0) {
            throw new BadRequestException('All resources are already in this group');
        }

        await this.prisma.resourceGroup.update({
            where: { id: groupId },
            data: {
                resources: {
                    connect: newResourceIds.map(id => ({ id })),
                },
            },
        });

        return { added: newResourceIds.length };
    }

    async removeResource(groupId: number, resourceId: number, user: UserContext) {
        await this.findOne(groupId, user);

        await this.prisma.resource.delete({
            where: {
                id: resourceId,
                groups: {
                    some: { id: groupId },
                },
            },
        });

        return { message: 'Resource removed from group' };
    }

    async findByType(type: ResourceType) {
        return this.groupRepository.findByType(type);
    }
}
