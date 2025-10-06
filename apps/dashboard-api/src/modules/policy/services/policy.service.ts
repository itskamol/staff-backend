import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreatePolicyDto, PolicyQueryDto, UpdatePolicyDto } from '../dto/policy.dto';
import { UserContext } from '../../../shared/interfaces';
import { PolicyRepository } from '../repositories/policy.repository';
import { OptionType, Prisma, RuleType } from '@prisma/client';

@Injectable()
export class PolicyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly policyRepository: PolicyRepository
    ) {}

    async findAll(query: PolicyQueryDto, scope: DataScope, user: UserContext) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            isScreenshotEnabled,
            isActiveWindowEnabled,
            isActive,
            isVisitedSitesEnabled,
        } = query;
        const where: Prisma.PolicyWhereInput = {};

        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }

        if (isScreenshotEnabled !== undefined) {
            where.isScreenshotEnabled = isScreenshotEnabled;
        }

        if (isActiveWindowEnabled !== undefined) {
            where.isActiveWindowEnabled = isActiveWindowEnabled;
        }

        if (isVisitedSitesEnabled !== undefined) {
            where.isVisitedSitesEnabled = isVisitedSitesEnabled;
        }

        if (isActive !== undefined) {
            where.isActive = isActive;
        }

        return this.policyRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                _count: { select: { employeeGroups: true } },
                options: {
                    select: {
                        type: true,
                        id: true,
                        rules: {
                            select: {
                                type: true,
                                group: { select: { name: true, id: true, type: true } },
                            },
                        },
                    },
                },
                organization: { select: { id: true, fullName: true, shortName: true } },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const policy = await this.policyRepository.findById(id, {
            employeeGroups: {
                select: {
                    id: true,
                    name: true,
                    organizationId: true,
                    _count: {
                        select: {
                            employees: true,
                        },
                    },
                },
            },
            options: {
                select: {
                    id: true,
                    type: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
        });

        if (!policy) {
            throw new NotFoundException('Policy not found');
        }

        return policy;
    }

    async create(dto: CreatePolicyDto, scope: DataScope) {
        const { organizationId = scope?.organizationId, options, ...createPolicyDto } = dto;

        if (!organizationId) throw new NotFoundException('Organization ID is required');

        // Options'ni prepare qilish
        const policyOptions = options?.map(option => {
            const rules = [];

            // Unuseful groups
            if (option?.groups?.unuseful?.length) {
                option.groups.unuseful.forEach(groupId => {
                    rules.push({
                        groupId,
                        type: RuleType.UNUSEFUL,
                    });
                });
            }

            // Useful groups
            if (option?.groups?.useful?.length) {
                option.groups.useful.forEach(groupId => {
                    rules.push({
                        groupId,
                        type: RuleType.USEFUL,
                    });
                });
            }

            return {
                type: option.type,
                rules:
                    rules.length > 0
                        ? {
                              createMany: {
                                  data: rules,
                              },
                          }
                        : undefined,
            };
        });

        const input: Prisma.PolicyCreateInput = {
            ...createPolicyDto,
            organization: { connect: { id: organizationId } },
            // Options va rules yaratish
            options: policyOptions?.length
                ? {
                      create: policyOptions, // createMany emas, create ishlatamiz
                  }
                : undefined,
        };

        return this.policyRepository.create(input, undefined, scope);
    }

    async update(id: number, updatePolicyDto: UpdatePolicyDto, user: UserContext) {
        // // Check if policy exists and access permissions
        // await this.findOne(id, user);
        // const policy = await this.prisma.policy.update({
        //     where: { id },
        //     data: updatePolicyDto,
        //     select: {
        //         id: true,
        //         title: true,
        //         isActive: true,
        //         createdAt: true,
        //         updatedAt: true,
        //     },
        // });
        // return policy;
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const policy = await this.policyRepository.findById(id, undefined, scope);

        if (!policy) throw new NotFoundException('Policy not found');

        const defaultPolicy = await this.policyRepository.findFirst(
            { isDefault: true },
            undefined,
            undefined,
            scope
        );
    }
}
