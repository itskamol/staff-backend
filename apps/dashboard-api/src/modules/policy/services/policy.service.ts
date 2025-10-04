import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreatePolicyDto, UpdatePolicyDto } from '../dto/policy.dto';
import { UserContext } from '../../../shared/interfaces';
import { PolicyRepository } from '../repositories/policy.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class PolicyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly policyRepository: PolicyRepository
    ) {}

    async findAll(query: QueryDto, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search } = query;
        const where: Prisma.PolicyWhereInput = {};

        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }

        return this.policyRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                _count: { select: { employees: true } },
                options: true,
                organization: { select: { id: true, fullName: true, shortName: true } },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const policy = await this.policyRepository.findById(id, {
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
            options: {
                select: {
                    id: true,
                    group: true,
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

    async create({ organizationId, ...createPolicyDto }: CreatePolicyDto, scope: DataScope) {
        return this.policyRepository.create(
            {
                ...createPolicyDto,
                organization: { connect: { id: organizationId } },
            },
            undefined,
            scope
        );
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
