import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import {
    CreatePolicyDto,
    CreatePolicyOptionDto,
    PolicyQueryDto,
    UpdatePolicyDto,
} from '../dto/policy.dto';
import { UserContext } from '../../../shared/interfaces';
import { PolicyRepository } from '../repositories/policy.repository';
import { Policy, Prisma, RuleType } from '@prisma/client';
import { EmployeeService } from '../../employee/repositories/employee.service';

@Injectable()
export class PolicyService {
    constructor(
        private readonly employeeService: EmployeeService,
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
                _count: { select: { employees: true } },
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

    async findOne(id: number, scope: DataScope, user: UserContext) {
        const policy = await this.policyRepository.findById(id, {
            employees: {
                select: {
                    id: true,
                    name: true,
                    organizationId: true,
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

        const policyOptions = this.extractOptions(options) || [];

        const input: Prisma.PolicyCreateInput = {
            ...createPolicyDto,
            organization: { connect: { id: organizationId } },
            options: { create: policyOptions },
        };

        return this.policyRepository.create(input, undefined, scope);
    }

    async update(id: number, updatePolicyDto: UpdatePolicyDto, scope: DataScope) {
        const policy = await this.policyRepository.findByIdOrThrow(
            id,
            { employees: { select: { id: true } } },
            scope
        );
        const { options, ...policyData } = updatePolicyDto;

        const policyOptions = this.extractOptions(options) || [];

        const input: Prisma.PolicyUpdateInput = {
            ...policyData,
            options: options ? { deleteMany: {}, create: policyOptions } : undefined,
        };

        return this.policyRepository.update(id, input, undefined, scope);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const policy: PolicyWithRelations = await this.policyRepository.findById(
            id,
            { employees: { select: { id: true } } },
            scope
        );

        const employeeIds = this.extractEmployeeIdsFromGroups(policy);

        if (!policy) throw new NotFoundException('Policy not found');

        const defaultPolicy = await this.policyRepository.getDefaultPolicy(scope.organizationId);

        if (employeeIds.length) {
        }
    }

    async getDefaultPolicy(organizationId: number) {
        return this.policyRepository.getDefaultPolicy(organizationId);
    }

    private extractOptions(options: CreatePolicyOptionDto[]) {
        return options?.map(option => {
            const rules = [];

            if (option?.unuseful?.length) {
                option.unuseful.forEach(groupId => {
                    rules.push({
                        groupId,
                        type: RuleType.UNUSEFUL,
                    });
                });
            }

            if (option?.useful?.length) {
                option.useful.forEach(groupId => {
                    rules.push({
                        groupId,
                        type: RuleType.USEFUL,
                    });
                });
            }

            return {
                type: option.type,
                rules: rules.length ? { createMany: { data: rules } } : undefined,
            };
        });
    }

    private extractEmployeeIdsFromGroups(policy: PolicyWithRelations) {
        const employeeIds = new Set<number>();
        policy.employeeGroups.forEach(group => {
            group.employees.forEach(emp => employeeIds.add(emp.id));
        });
        return Array.from(employeeIds);
    }
}

interface PolicyWithRelations extends Policy {
    employeeGroups: {
        id: number;
        name: string;
        organizationId: number;
        employees: { id: number }[];
    }[];
}
