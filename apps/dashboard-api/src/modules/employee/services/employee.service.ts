import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FILE_STORAGE_SERVICE, IFileStorageService } from '@app/shared/common';
import { DataScope, UserContext } from '@app/shared/auth';
import {
    BulkUpdateEmployees,
    CreateEmployeeDto,
    EmployeeQueryDto,
    UpdateEmployeeDto,
} from '../dto';
import { DepartmentService } from '../../department/department.service';
import { QueryDto } from '@app/shared/utils';
import { Prisma } from '@prisma/client';
import { PolicyService } from '../../policy/services/policy.service';
import { EmployeeRepository } from '../repositories/employee.repository';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { PrismaService } from '@app/shared/database';
import { OrganizationService } from '../../organization/organization.service';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';

@Injectable()
export class EmployeeService {
    constructor(
        private readonly employeeRepository: EmployeeRepository,
        private readonly departmentService: DepartmentService,
        private readonly policyService: PolicyService,
        @Inject(FILE_STORAGE_SERVICE)
        private readonly fileStorage: IFileStorageService,
        private readonly organizationService: OrganizationService,
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue
    ) {}

    async getEmployees(query: EmployeeQueryDto, scope: DataScope, user: UserContext) {
        const { page = 1, limit = 10, search, sort, order, credentialType, ...filters } = query;

        let whereClause: Prisma.EmployeeWhereInput = {};
        if (search) {
            whereClause.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (credentialType) {
            whereClause.credentials = {
                some: {
                    type: credentialType,
                },
            };
        }

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

    async findByIds(ids: number[], scope: DataScope) {
        return this.employeeRepository.findMany(
            {
                id: { in: ids },
                ...(scope?.organizationId ? { organizationId: scope?.organizationId } : {}),
            },
            { id: 'asc' },
            undefined,
            undefined,
            undefined,
            scope
        );
    }

    async getEmployeeById(id: number, scope: DataScope, user: UserContext) {
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            {
                department: {
                    select: { id: true, fullName: true, shortName: true, organizationId: true },
                },
                policy: {
                    select: { id: true, title: true, organizationId: true },
                },
                organization: {
                    select: { id: true, fullName: true, shortName: true },
                },
                job: { select: { id: true, uz: true, eng: true, ru: true } },
                plan: true,
                credentials: true,
                gates: { include: { devices: true } },
                employeeSyncs: true,
            },
            scope,
            user.role
        );

        return employee;
    }
    async getEmployee(id: number) {
        return this.employeeRepository.findById(id);
    }

    async createEmployee(dto: CreateEmployeeDto, scope: DataScope, user: UserContext) {
        const department = await this.departmentService.getDepartmentById(dto.departmentId, scope);

        if (!department) {
            throw new NotFoundException('Department not found or access denied');
        }

        if (dto.policyId) {
            const group = await this.policyService.findOne(dto.policyId, scope, user);
            if (!group) {
                throw new NotFoundException('Employee group not found or access denied');
            }
        } else {
            const defaultGroup = await this.policyService.getDefaultPolicy(
                department.organizationId
            );
            dto.policyId = defaultGroup.id;
        }

        const photoKey = await this.normalizeStorageKey(dto.photo);

        const organization = await this.organizationService.getOrganizationById(
            department.organizationId
        );

        if (!organization) {
            throw new NotFoundException('Departmant Organization not found!');
        }

        const plan = await this.organizationService.getOrganizationDefaultPlan(organization.id);

        const createData: Prisma.EmployeeCreateInput = {
            name: dto.name,
            address: dto.address,
            phone: dto.phone,
            email: dto.email,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
            department: {
                connect: { id: dto.departmentId },
            },
            policy: { connect: { id: dto.policyId } },
            organization: {
                connect: { id: department.organizationId },
            },
            plan: {
                connect: { id: plan?.employeePlans[0]?.id },
            },
            job: {
                connect: { id: dto?.jobId },
            },
        };

        if (dto.credentials && dto.credentials.length) {
            const credentialsWithOrgId = dto.credentials.map(credential => ({
                ...credential,
                organizationId: department.organizationId,
            }));
            createData.credentials = {
                createMany: {
                    data: credentialsWithOrgId,
                },
            };
        }

        if (photoKey) {
            createData.photo = photoKey;
        }

        return await this.employeeRepository.createWithValidation(createData, undefined, user.role);
    }

    async updateEmployee(id: number, dto: UpdateEmployeeDto, scope: DataScope, user: UserContext) {
        const existingEmployee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!existingEmployee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        const { departmentId, policyId, ...data } = dto;
        const updateData: Prisma.EmployeeUpdateInput = { ...data };

        if (dto.photo !== undefined) {
            const newPhotoKey = await this.normalizeStorageKey(dto.photo);

            if (existingEmployee.photo && existingEmployee.photo !== newPhotoKey) {
                const exists = await this.fileStorage.exists(existingEmployee.photo);
                if (exists) {
                    await this.fileStorage.deleteObject(existingEmployee.photo);
                }
            }

            updateData.photo = newPhotoKey;
        }

        if (departmentId) {
            updateData.department = {
                connect: { id: departmentId },
            };
        }

        if (policyId) {
            updateData.policy = {
                connect: { id: policyId },
            };
        }

        return await this.employeeRepository.updateWithValidation(id, updateData, scope, user.role);
    }

    async updateManyEmployees(
        ids: number[],
        dto: UpdateEmployeeDto,
        scope: DataScope,
        user: UserContext
    ) {
        if (!ids || ids.length === 0) {
            throw new Error('No employee IDs provided');
        }

        const results = [];

        for (const id of ids) {
            try {
                const updated = await this.updateEmployee(id, dto, scope, user);
                results.push({
                    id,
                    status: 'success',
                    employee: updated,
                });
            } catch (error) {
                results.push({
                    id,
                    status: 'failed',
                    error: error.message,
                });
            }
        }

        return results;
    }

    async bulkUpdateEmployees(dto: BulkUpdateEmployees, scope: DataScope, user: UserContext) {
        const updateData: Prisma.EmployeeUpdateInput = {};
        if (dto.policyId) {
            updateData.policy = {
                connect: { id: dto.policyId },
            };
        }

        if (!dto.policyId) {
            throw new NotFoundException('No valid fields to update');
        }

        return await this.employeeRepository.bulkUpdateWithValidation(
            { id: { in: dto.employeeIds } },
            updateData,
            scope,
            user.role
        );
    }

    async deleteEmployee(id: number, scope: DataScope, user: UserContext) {
        const employee = await this.employeeRepository.findByIdWithRoleScope(
            id,
            undefined,
            scope,
            user.role
        );
        if (!employee) {
            throw new NotFoundException('Employee not found or access denied');
        }

        await this.deviceQueue.add(JOB.DEVICE.REMOVE_EMPLOYEES, {
            employeeIds: [id],
        });

        return await this.employeeRepository.softDelete(id, scope);
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

    private async normalizeStorageKey(key?: string | null): Promise<string | null> {
        if (!key) {
            return null;
        }

        const sanitized = key.replace(/^\/*/, '').trim();
        if (!sanitized) {
            return null;
        }

        const exists = await this.fileStorage.exists(sanitized);
        if (!exists) {
            throw new NotFoundException('Referenced file not found in storage');
        }

        return sanitized;
    }
}
