import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import { QueryBuilderUtil, PaginationDto } from '@app/shared/utils';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policy.dto';
import { UserContext } from '../../shared/interfaces';
import { PolicyRepository } from './repositories/policy.repository';

@Injectable()
export class PolicyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly policyRepository: PolicyRepository,
    ) {}

    async findAll(paginationDto: PaginationDto, user: UserContext) {
        const query = QueryBuilderUtil.buildQuery(paginationDto);

        if (user.role === Role.HR) {
            query.where.employees = {
                some: {
                    department: {
                        organizationId: user.organizationId,
                    },
                },
            };
        }

        const [policies, totalRecords] = await Promise.all([
            this.prisma.policy.findMany({
                where: query.where,
                skip: query.skip,
                take: query.take,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    title: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            employees: true,
                        },
                    },
                },
            }),
            this.prisma.policy.count({ where: query.where }),
        ]);

        return QueryBuilderUtil.buildResponse(
            policies,
            totalRecords,
            paginationDto.page || 1,
            paginationDto.limit || 10
        );
    }

    async findOne(id: number, user: UserContext) {
        const policy = await this.prisma.policy.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                employees: {
                    select: {
                        id: true,
                        name: true,
                        department: {
                            select: {
                                id: true,
                                fullName: true,
                                organizationId: true,
                            },
                        },
                    },
                },
            },
        });

        if (!policy) {
            throw new NotFoundException('Policy not found');
        }

        // Check access permissions for HR
        if (user.role === Role.HR) {
            const hasAccess = policy.employees.some(
                employee => employee.department.organizationId === user.organizationId
            );
            if (!hasAccess) {
                throw new ForbiddenException('Access denied to this policy');
            }
        }

        return policy;
    }

    async create(createPolicyDto: CreatePolicyDto, user: UserContext) {
        const policy = await this.prisma.policy.create({
            data: createPolicyDto,
            select: {
                id: true,
                title: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return policy;
    }

    async update(id: number, updatePolicyDto: UpdatePolicyDto, user: UserContext) {
        // Check if policy exists and access permissions
        await this.findOne(id, user);

        const policy = await this.prisma.policy.update({
            where: { id },
            data: updatePolicyDto,
            select: {
                id: true,
                title: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return policy;
    }

    async remove(id: number, user: UserContext) {
        // Check if policy exists and access permissions
        const policy = await this.findOne(id, user);

        // Check if policy has employees assigned
        if (policy.employees && policy.employees.length > 0) {
            // Soft delete
            await this.prisma.policy.update({
                where: { id },
                data: { isActive: false },
            });
        } else {
            // Hard delete
            await this.prisma.policy.delete({
                where: { id },
            });
        }
    }
}
