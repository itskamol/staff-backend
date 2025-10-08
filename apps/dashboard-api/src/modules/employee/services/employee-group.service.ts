import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import {
    CreateEmployeeGroupDto,
    UpdateEmployeeGroupDto,
    EmployeeGroupQueryDto,
} from '../dto';
import { UserContext } from '../../../shared/interfaces';
import { EmployeeGroupRepository } from '../repositories/employee-group.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmployeeGroupService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly employeeGroupRepository: EmployeeGroupRepository
    ) {}

    async findAll(query: EmployeeGroupQueryDto, scope: DataScope, user: UserContext) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            organizationId,
            startDate,
            endDate,
            isActive,
            isDefault,
            name,
        } = query;
        const where: Prisma.EmployeeGroupWhereInput = {};

        const searchTerm = (search || name)?.trim();
        if (searchTerm) {
            where.OR = [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { description: { contains: searchTerm, mode: 'insensitive' } },
            ];
        }

        if (typeof isActive === 'boolean') {
            where.isActive = isActive;
        }

        if (typeof isDefault === 'boolean') {
            where.isDefault = isDefault;
        }

        if (organizationId) {
            where.organizationId = organizationId;
        }

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        return this.employeeGroupRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                _count: {
                    select: {
                        employees: true,
                    },
                },
                policy: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, scope: DataScope, user: UserContext) {
        const group = await this.employeeGroupRepository.findById(
            id,
            {
                employees: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        departmentId: true,
                    },
                    take: 10, // Limit to avoid large response
                },
                policy: {
                    select: {
                        id: true,
                        title: true,
                        isActiveWindowEnabled: true,
                        isScreenshotEnabled: true,
                        isVisitedSitesEnabled: true,
                    },
                },
                _count: {
                    select: {
                        employees: true,
                    },
                },
            },
            scope
        );

        if (!group) {
            throw new NotFoundException('Employee group not found');
        }

        return group;
    }

    async create(createEmployeeGroupDto: CreateEmployeeGroupDto, scope: DataScope) {
        const organizationId = scope?.organizationId || createEmployeeGroupDto?.organizationId;
        if (!organizationId) {
            throw new BadRequestException('Organization ID is required');
        }

        // Check if group with same name already exists in organization
        const exists = await this.employeeGroupRepository.existsByName(
            organizationId,
            createEmployeeGroupDto.name
        );

        if (exists) {
            throw new ConflictException(
                `Employee group with name "${createEmployeeGroupDto.name}" already exists in your organization`
            );
        }

        const input: Prisma.EmployeeGroupCreateInput = {
            name: createEmployeeGroupDto.name,
            description: createEmployeeGroupDto.description,
            isActive: createEmployeeGroupDto.isActive !== false,
            organization: {
                connect: { id: organizationId },
            },
        };

        if (createEmployeeGroupDto.employees && createEmployeeGroupDto.employees.length > 0) {
            input.employees = {
                connect: createEmployeeGroupDto.employees.map(empId => ({ id: empId })),
            };
        }

        // Add policy if provided
        if (createEmployeeGroupDto.policyId) {
            input.policy = {
                connect: { id: createEmployeeGroupDto.policyId },
            };
        }

        return this.employeeGroupRepository.create(input, undefined, scope);
    }

    async update(
        id: number,
        updateEmployeeGroupDto: UpdateEmployeeGroupDto,
        scope: DataScope,
        user: UserContext
    ) {
        // Verify group exists and user has access
        await this.findOne(id, scope, user);

        // Check name conflict if name is being updated
        if (updateEmployeeGroupDto.name) {
            const exists = await this.employeeGroupRepository.existsByName(
                scope.organizationId!,
                updateEmployeeGroupDto.name,
                id
            );

            if (exists) {
                throw new ConflictException(
                    `Employee group with name "${updateEmployeeGroupDto.name}" already exists in your organization`
                );
            }
        }

        const updateData: Prisma.EmployeeGroupUpdateInput = {};

        if (updateEmployeeGroupDto.name !== undefined) {
            updateData.name = updateEmployeeGroupDto.name;
        }
        if (updateEmployeeGroupDto.description !== undefined) {
            updateData.description = updateEmployeeGroupDto.description;
        }

        if (updateEmployeeGroupDto.isActive !== undefined) {
            updateData.isActive = updateEmployeeGroupDto.isActive;
        }
        if (updateEmployeeGroupDto.policyId !== undefined) {
            if (updateEmployeeGroupDto.policyId === null) {
                updateData.policy = {
                    disconnect: true,
                };
            } else {
                updateData.policy = {
                    connect: { id: updateEmployeeGroupDto.policyId },
                };
            }
        }

        return this.employeeGroupRepository.update(id, updateData);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        // Verify group exists and user has access
        const group = await this.findOne(id, scope, user);

        // Check if group has employees
        const employeeCount = await this.employeeGroupRepository.countEmployees(id);

        if (employeeCount > 0) {
            throw new BadRequestException(
                `Cannot delete employee group. It has ${employeeCount} employee(s). Please reassign them first.`
            );
        }

        // Prevent deletion of default group
        if (group.isDefault) {
            throw new BadRequestException(
                'Cannot delete the default employee group. Set another group as default first.'
            );
        }

        return this.employeeGroupRepository.delete(id);
    }

    /**
     * Get default group for an organization
     */
    async getDefaultGroup(organizationId: number) {
        const group = await this.employeeGroupRepository.findDefaultByOrganization(organizationId);

        if (!group) {
            throw new NotFoundException(
                'No default employee group found for this organization. Please create one first.'
            );
        }

        return group;
    }

    /**
     * Set a group as default
     */
    async setAsDefault(id: number, scope: DataScope, user: UserContext) {
        // Verify group exists
        await this.findOne(id, scope, user);

        // Unset all other defaults
        await this.prisma.employeeGroup.updateMany({
            where: {
                organizationId: scope.organizationId,
                isDefault: true,
            },
            data: {
                isDefault: false,
            },
        });

        // Set this one as default
        return this.employeeGroupRepository.update(id, {
            isDefault: true,
        });
    }

    /**
     * Get employees count for a group
     */
    async getEmployeesCount(id: number, scope: DataScope, user: UserContext) {
        await this.findOne(id, scope, user);
        const count = await this.employeeGroupRepository.countEmployees(id);
        return { count };
    }
}
