import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreatePolicyOptionDto, UpdatePolicyOptionDto, BulkCreatePolicyOptionDto } from '../dto/policy-option.dto';
import { UserContext } from '../../../shared/interfaces';
import { PolicyOptionRepository } from '../repositories/policy-option.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PolicyOptionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly policyOptionRepository: PolicyOptionRepository
    ) {}

    async findAll(query: QueryDto & { policyId?: string; groupId?: string }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', policyId, groupId } = query;
        const where: Prisma.PolicyOptionWhereInput = {};

        if (policyId) {
            where.policyId = parseInt(policyId as string);
        }

        if (groupId) {
            where.groupId = parseInt(groupId as string);
        }

        return this.policyOptionRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                policy: {
                    select: {
                        id: true,
                        title: true
                    }
                },
                group: {
                    select: {
                        id: true,
                        name: true,
                        type: true
                    }
                }
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const policyOption = await this.policyOptionRepository.findById(id, {
            policy: {
                select: {
                    id: true,
                    title: true,
                    organizationId: true
                }
            },
            group: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            }
        });

        if (!policyOption) {
            throw new NotFoundException('Policy option not found');
        }

        return policyOption;
    }

    async create(createPolicyOptionDto: CreatePolicyOptionDto, scope: DataScope) {
        // Check if policy-group combination already exists
        const existing = await this.policyOptionRepository.findByPolicyAndGroup(
            createPolicyOptionDto.policyId,
            createPolicyOptionDto.groupId
        );

        if (existing) {
            throw new BadRequestException('Policy-group combination already exists');
        }

        // Verify policy and group exist
        const [policy, group] = await Promise.all([
            this.prisma.policy.findUnique({ where: { id: createPolicyOptionDto.policyId } }),
            this.prisma.group.findUnique({ where: { id: createPolicyOptionDto.groupId } })
        ]);

        if (!policy) {
            throw new NotFoundException('Policy not found');
        }

        if (!group) {
            throw new NotFoundException('Group not found');
        }

        return this.policyOptionRepository.create({
            policy: { connect: { id: createPolicyOptionDto.policyId } },
            group: { connect: { id: createPolicyOptionDto.groupId } },
            type: createPolicyOptionDto.type,
            isActive: createPolicyOptionDto.isActive
        }, undefined, scope);
    }

    async update(id: number, updatePolicyOptionDto: UpdatePolicyOptionDto, user: UserContext) {
        await this.findOne(id, user);

        // If updating policy or group, check for duplicates
        if (updatePolicyOptionDto.policyId || updatePolicyOptionDto.groupId) {
            const current = await this.policyOptionRepository.findById(id);
            const policyId = updatePolicyOptionDto.policyId || current.policyId;
            const groupId = updatePolicyOptionDto.groupId || current.groupId;

            const existing = await this.policyOptionRepository.findByPolicyAndGroup(policyId, groupId);
            if (existing && existing.id !== id) {
                throw new BadRequestException('Policy-group combination already exists');
            }
        }

        return this.policyOptionRepository.update(id, updatePolicyOptionDto);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const policyOption = await this.policyOptionRepository.findById(id, undefined, scope);

        if (!policyOption) {
            throw new NotFoundException('Policy option not found');
        }

        return this.policyOptionRepository.delete(id, scope);
    }

    async findByPolicyId(policyId: number) {
        return this.policyOptionRepository.findByPolicyId(policyId, {
            group: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            }
        });
    }

    async findByGroupId(groupId: number) {
        return this.policyOptionRepository.findByGroupId(groupId, {
            policy: {
                select: {
                    id: true,
                    title: true
                }
            }
        });
    }

    async bulkCreate(bulkCreateDto: BulkCreatePolicyOptionDto, scope: DataScope) {
        const { policyId, groupIds, type } = bulkCreateDto;

        // Verify policy exists
        const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
        if (!policy) {
            throw new NotFoundException('Policy not found');
        }

        // Verify all groups exist
        const groups = await this.prisma.group.findMany({
            where: { id: { in: groupIds } }
        });

        if (groups.length !== groupIds.length) {
            throw new BadRequestException('Some groups not found');
        }

        // Check for existing combinations
        const existing = await this.policyOptionRepository.findMany({
            policyId,
            groupId: { in: groupIds }
        });

        const existingGroupIds = existing.map(po => po.groupId);
        const newGroupIds = groupIds.filter(id => !existingGroupIds.includes(id));

        if (newGroupIds.length === 0) {
            throw new BadRequestException('All policy-group combinations already exist');
        }

        // Create new policy options
        await this.prisma.policyOption.createMany({
            data: newGroupIds.map(groupId => ({
                policyId,
                groupId,
                type: type as any
            }))
        });

        return { 
            created: newGroupIds.length, 
            skipped: existingGroupIds.length 
        };
    }

    async removeByPolicyId(policyId: number, scope: DataScope) {
        return this.policyOptionRepository.deleteByPolicyId(policyId);
    }

    async removeByGroupId(groupId: number, scope: DataScope) {
        return this.policyOptionRepository.deleteByGroupId(groupId);
    }
}