import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeRepository } from '../employee.repository';
import { DataScope, UserContext } from '@app/shared/auth';
// import { UserContext } from '../../../shared/interfaces';
import { CreateEmployeeDto, UpdateEmployeeDto } from '../../../shared/dto';
import { DepartmentService } from '../../department/department.service';
import { QueryDto } from '@app/shared/utils';

@Injectable()
export class EmployeeService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
        private readonly departmentService: DepartmentService
    ) {}

    async getEmployees(query: QueryDto, scope: DataScope, user: UserContext) {
        const { page = 1, limit = 10, search, sort, order, ...filters } = query;

        // Build where clause
        let whereClause: any = {};

        // Apply search
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Apply filters
        Object.keys(filters).forEach(key => {
            if (filters[key] !== undefined) {
                whereClause[key] = filters[key];
            }
        });

        const pagination = { page, limit };

        return this.employeeRepository.findManyWithPagination(
            whereClause,
            sort ? { [sort]: order || 'asc' } : { createdAt: 'desc' },
            { department: { select: { shortName: true } } },
            pagination,
            scope
        );
    }

    async getEmployeeById(id: number, scope: DataScope, user: UserContext) {
        return this.employeeRepository.findByIdWithRoleScope(id, undefined, scope, user.role);
    }

    async createEmployee(dto: CreateEmployeeDto, scope: DataScope, user: UserContext) {
        const department = await this.departmentService.getDepartmentById(dto.departmentId, scope);

        if (!department) {
            throw new NotFoundException('Department not found or access denied');
        }

        const createData = {
            name: dto.name,
            address: dto.address,
            phone: dto.phone,
            email: dto.email,
            photo: dto.photo,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
            department: {
                connect: { id: dto.departmentId },
            },
            ...(dto.policyId
                ? {
                      policy: {
                          connect: { id: dto.policyId },
                      },
                  }
                : {}),
            organization: {
                connect: { id: department.organizationId },
            },
        };

        return await this.employeeRepository.createWithValidation(createData, undefined, user.role);
    }

    async updateEmployee(id: number, dto: UpdateEmployeeDto, scope: DataScope, user: UserContext) {
        const updateData: any = {
            ...(dto.name && { name: dto.name }),
            ...(dto.address !== undefined && { address: dto.address }),
            ...(dto.phone !== undefined && { phone: dto.phone }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.photo !== undefined && { photo: dto.photo }),
            ...(dto.additionalDetails !== undefined && {
                additionalDetails: dto.additionalDetails,
            }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        };

        if (dto.departmentId) {
            updateData.department = {
                connect: { id: dto.departmentId },
            };
        }

        if (dto.policyId) {
            updateData.policy = {
                connect: { id: dto.policyId },
            };
        }

        return await this.employeeRepository.updateWithValidation(id, updateData, scope, user.role);
    }

    async deleteEmployee(id: number, scope: DataScope, user: UserContext) {
        // Verify access through repository
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        return await this.employeeRepository.delete(id);
    }

    async getEmployeeEntryLogs(id: number, query: QueryDto, scope: DataScope, user: UserContext) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        const { page = 1, limit = 10 } = query;
        const pagination = { page, limit };

        const { logs, total } = await this.employeeRepository.getEmployeeEntryLogs(id, pagination);

        return {
            data: logs,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async getEmployeeActivityReport(
        id: number,
        query: QueryDto,
        scope: DataScope,
        user: UserContext
    ) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        // Parse date range from query if provided
        const dateRange =
            query.startDate && query.endDate
                ? {
                      startDate: new Date(query.startDate),
                      endDate: new Date(query.endDate),
                  }
                : undefined;

        return await this.employeeRepository.getEmployeeActivityStats(id, dateRange);
    }

    async getEmployeeComputerUsers(id: number, scope: DataScope, user: UserContext) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        const computerUsers = await this.employeeRepository.getEmployeeComputerUsers(id);

        return {
            employeeId: id,
            data: computerUsers,
        };
    }

    async assignCardToEmployee(id: number, dto: any, scope: DataScope, user: UserContext) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        const credential = await this.employeeRepository.assignCredential(id, {
            code: dto.cardId,
            type: 'CARD',
            additionalDetails: dto.additionalDetails,
        });

        return {
            employeeId: id,
            credential,
            message: 'Card assigned successfully',
        };
    }

    async assignCarToEmployee(id: number, dto: any, scope: DataScope, user: UserContext) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        const credential = await this.employeeRepository.assignCredential(id, {
            code: dto.carId,
            type: 'CAR',
            additionalDetails: dto.additionalDetails,
        });

        return {
            employeeId: id,
            credential,
            message: 'Car assigned successfully',
        };
    }

    async linkComputerUserToEmployee(id: number, dto: any, scope: DataScope, user: UserContext) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        const computerUser = await this.employeeRepository.linkComputerUser(id, dto.computerUserId);

        return {
            employeeId: id,
            computerUser,
            message: 'Computer user linked successfully',
        };
    }

    async unlinkComputerUserFromEmployee(
        id: number,
        computerUserId: number,
        scope: DataScope,
        user: UserContext
    ) {
        // Verify access to employee
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        await this.employeeRepository.unlinkComputerUser(id, computerUserId);

        return {
            employeeId: id,
            computerUserId,
            message: 'Computer user unlinked successfully',
        };
    }
}
