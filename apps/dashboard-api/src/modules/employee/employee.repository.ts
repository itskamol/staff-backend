import { Injectable } from '@nestjs/common';
import { Employee, Prisma, Role } from '@prisma/client';
import { BaseRepository } from '../../shared/repositories/base.repository';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';

export type EmployeeWithRelations = Employee & {
    department?: {
        id: number;
        fullName: string;
        shortName: string;
        organizationId?: number;
    };
    policy?: {
        id: number;
        title: string;
    };
    credentials?: Array<{
        id: number;
        code: string;
        type: string;
        isActive: boolean;
    }>;
    computerUsers?: Array<{
        id: number;
        name: string;
        username: string;
        isActive: boolean;
    }>;
};

@Injectable()
export class EmployeeRepository extends BaseRepository<
    EmployeeWithRelations,
    Prisma.EmployeeCreateInput,
    Prisma.EmployeeUpdateInput,
    Prisma.EmployeeWhereInput,
    Prisma.EmployeeWhereUniqueInput,
    Prisma.EmployeeOrderByWithRelationInput,
    Prisma.EmployeeInclude
> {
    protected readonly modelName = 'Employee';

    constructor(prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.employee;
    }

    /**
     * Override data scope application for employee-specific logic
     */
    protected applyDataScope(
        where: Record<string, unknown>,
        scope?: DataScope,
        userRole?: Role
    ): Record<string, unknown> {
        if (!scope || !userRole) return where;

        const scopedWhere = { ...where };

        // Apply role-based scoping
        switch (userRole) {
            case Role.DEPARTMENT_LEAD:
                // Department leads can only see employees in their department
                scopedWhere.id = { in: scope.departments };
                break;
            
            case Role.HR:
                // HR can see employees from their organization's departments
                scopedWhere.department = {
                    organizationId: scope.organizationId
                };
                break;
            
            case Role.GUARD:
                // Guards have basic read access, apply organization scope
                scopedWhere.department = {
                    organizationId: scope.organizationId
                };
                break;
            
            case Role.ADMIN:
                // Admins can see all employees - no additional scoping
                break;
        }

        return scopedWhere;
    }

    /**
     * Find employees with role-based scoping
     */
    async findManyWithRoleScope(
        where?: Prisma.EmployeeWhereInput,
        orderBy?: Prisma.EmployeeOrderByWithRelationInput,
        include?: Prisma.EmployeeInclude,
        pagination?: { page: number; limit: number },
        scope?: DataScope,
        userRole?: Role
    ): Promise<EmployeeWithRelations[]> {
        const scopedWhere = this.applyDataScope(where || {}, scope, userRole) as Prisma.EmployeeWhereInput;

        const options: Prisma.EmployeeFindManyArgs = {
            where: scopedWhere,
            orderBy: orderBy || { createdAt: 'desc' },
            include: include || this.getDefaultInclude(),
        };

        if (pagination) {
            const skip = (pagination.page - 1) * pagination.limit;
            options.skip = skip;
            options.take = pagination.limit;
        }

        return await this.getDelegate().findMany(options);
    }

    /**
     * Find employee by ID with role-based scoping
     */
    async findByIdWithRoleScope(
        id: number,
        include?: Prisma.EmployeeInclude,
        scope?: DataScope,
        userRole?: Role
    ): Promise<EmployeeWithRelations | null> {
        const where = { id };
        const scopedWhere = this.applyDataScope(where, scope, userRole) as Prisma.EmployeeWhereInput;

        return await this.getDelegate().findFirst({
            where: scopedWhere,
            include: include || this.getDefaultInclude(),
        });
    }

    /**
     * Count employees with role-based scoping
     */
    async countWithRoleScope(
        where?: Prisma.EmployeeWhereInput,
        scope?: DataScope,
        userRole?: Role
    ): Promise<number> {
        const scopedWhere = this.applyDataScope(where || {}, scope, userRole) as Prisma.EmployeeWhereInput;

        return await this.getDelegate().count({
            where: scopedWhere,
        });
    }

    /**
     * Create employee with department validation
     */
    async createWithValidation(
        data: Prisma.EmployeeCreateInput,
        scope?: DataScope,
        userRole?: Role
    ): Promise<EmployeeWithRelations> {
        // For HR role, validate that department belongs to their organization
        if (userRole === Role.HR && scope?.organizationId && typeof data.department === 'object' && 'connect' in data.department) {
            const departmentId = (data.department.connect as { id: number }).id;
            
            const department = await this.prisma.department.findFirst({
                where: {
                    id: departmentId,
                    organizationId: scope.organizationId,
                },
            });

            if (!department) {
                throw new Error('Cannot create employee in this department');
            }
        }

        return await this.create(data, this.getDefaultInclude());
    }

    /**
     * Update employee with department validation
     */
    async updateWithValidation(
        id: number,
        data: Prisma.EmployeeUpdateInput,
        scope?: DataScope,
        userRole?: Role
    ): Promise<EmployeeWithRelations> {
        // Validate access to the employee first
        const employee = await this.findByIdWithRoleScope(id, undefined, scope, userRole);
        if (!employee) {
            throw new Error('Employee not found or access denied');
        }

        // For HR role, validate department change if applicable
        if (userRole === Role.HR && scope?.organizationId && data.department && typeof data.department === 'object' && 'connect' in data.department) {
            const departmentId = (data.department.connect as { id: number }).id;
            
            const department = await this.prisma.department.findFirst({
                where: {
                    id: departmentId,
                    organizationId: scope.organizationId,
                },
            });

            if (!department) {
                throw new Error('Cannot move employee to this department');
            }
        }

        return await this.update(id, data, this.getDefaultInclude());
    }

    /**
     * Get employee entry logs (actions)
     */
    async getEmployeeEntryLogs(
        employeeId: number,
        pagination?: { page: number; limit: number },
        dateRange?: { startDate?: Date; endDate?: Date }
    ) {
        const where: Prisma.ActionWhereInput = {
            employeeId,
            visitorType: 'EMPLOYEE',
        };

        if (dateRange?.startDate || dateRange?.endDate) {
            where.actionTime = {};
            if (dateRange.startDate) {
                where.actionTime.gte = dateRange.startDate;
            }
            if (dateRange.endDate) {
                where.actionTime.lte = dateRange.endDate;
            }
        }

        const options: Prisma.ActionFindManyArgs = {
            where,
            orderBy: { actionTime: 'desc' },
            include: {
                device: {
                    select: {
                        id: true,
                        name: true,
                        entryType: true,
                    }
                },
                gate: {
                    select: {
                        id: true,
                        name: true,
                    }
                },
            },
        };

        if (pagination) {
            const skip = (pagination.page - 1) * pagination.limit;
            options.skip = skip;
            options.take = pagination.limit;
        }

        const [logs, total] = await Promise.all([
            this.prisma.action.findMany(options),
            this.prisma.action.count({ where }),
        ]);

        return { logs, total };
    }

    /**
     * Get employee computer users with activity data
     */
    async getEmployeeComputerUsers(employeeId: number) {
        return await this.prisma.computerUser.findMany({
            where: { employeeId },
            include: {
                usersOnComputers: {
                    include: {
                        computer: {
                            select: {
                                id: true,
                                computerUid: true,
                                os: true,
                                ipAddress: true,
                            }
                        },
                        userSessions: {
                            orderBy: { startTime: 'desc' },
                            take: 5, // Last 5 sessions
                        },
                    },
                },
            },
        });
    }

    /**
     * Get employee activity statistics
     */
    async getEmployeeActivityStats(
        employeeId: number,
        dateRange?: { startDate?: Date; endDate?: Date }
    ) {
        const computerUsers = await this.prisma.computerUser.findMany({
            where: { employeeId },
            include: {
                usersOnComputers: {
                    include: {
                        activeWindows: {
                            where: dateRange ? {
                                datetime: {
                                    gte: dateRange.startDate,
                                    lte: dateRange.endDate,
                                }
                            } : undefined,
                        },
                        visitedSites: {
                            where: dateRange ? {
                                datetime: {
                                    gte: dateRange.startDate,
                                    lte: dateRange.endDate,
                                }
                            } : undefined,
                        },
                        userSessions: {
                            where: dateRange ? {
                                startTime: {
                                    gte: dateRange.startDate,
                                    lte: dateRange.endDate,
                                }
                            } : undefined,
                        },
                    },
                },
            },
        });

        // Calculate statistics
        let totalActiveTime = 0;
        let totalSessions = 0;
        let totalActiveWindows = 0;
        let totalVisitedSites = 0;

        computerUsers.forEach(cu => {
            cu.usersOnComputers.forEach(uoc => {
                totalSessions += uoc.userSessions.length;
                totalActiveWindows += uoc.activeWindows.length;
                totalVisitedSites += uoc.visitedSites.length;
                totalActiveTime += uoc.activeWindows.reduce((sum, aw) => sum + aw.activeTime, 0);
            });
        });

        return {
            employeeId,
            totalActiveTime,
            totalSessions,
            totalActiveWindows,
            totalVisitedSites,
            computerUsers: computerUsers.length,
            detailedData: computerUsers,
        };
    }

    /**
     * Assign credential (card/car) to employee
     */
    async assignCredential(
        employeeId: number,
        credentialData: {
            code: string;
            type: 'CARD' | 'CAR' | 'QR' | 'PERSONAL_CODE';
            additionalDetails?: string;
        }
    ) {
        return await this.prisma.credential.create({
            data: {
                employeeId,
                code: credentialData.code,
                type: credentialData.type,
                additionalDetails: credentialData.additionalDetails,
            },
        });
    }

    /**
     * Link computer user to employee
     */
    async linkComputerUser(employeeId: number, computerUserId: number) {
        return await this.prisma.computerUser.update({
            where: { id: computerUserId },
            data: { employeeId },
        });
    }

    /**
     * Unlink computer user from employee
     */
    async unlinkComputerUser(employeeId: number, computerUserId: number) {
        // Verify the computer user belongs to this employee
        const computerUser = await this.prisma.computerUser.findFirst({
            where: {
                id: computerUserId,
                employeeId,
            },
        });

        if (!computerUser) {
            throw new Error('Computer user not found or not linked to this employee');
        }

        return await this.prisma.computerUser.delete({
            where: { id: computerUserId },
        });
    }

    /**
     * Search employees by name, email, or phone
     */
    async searchEmployees(
        searchTerm: string,
        scope?: DataScope,
        userRole?: Role,
        pagination?: { page: number; limit: number }
    ): Promise<EmployeeWithRelations[]> {
        const where: Prisma.EmployeeWhereInput = {
            OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { email: { contains: searchTerm, mode: 'insensitive' } },
                { phone: { contains: searchTerm, mode: 'insensitive' } },
            ],
        };

        return await this.findManyWithRoleScope(
            where,
            { name: 'asc' },
            this.getDefaultInclude(),
            pagination,
            scope,
            userRole
        );
    }

    /**
     * Get default include for employee queries
     */
    private getDefaultInclude(): Prisma.EmployeeInclude {
        return {
            department: {
                select: {
                    id: true,
                    fullName: true,
                    shortName: true,
                    organizationId: true,
                }
            },
            policy: {
                select: {
                    id: true,
                    title: true,
                }
            },
        };
    }

    /**
     * Get employees by department
     */
    async findByDepartment(
        departmentId: number,
        include?: Prisma.EmployeeInclude,
        pagination?: { page: number; limit: number }
    ): Promise<EmployeeWithRelations[]> {
        return await this.findMany(
            { departmentId },
            { name: 'asc' },
            include || this.getDefaultInclude(),
            pagination
        );
    }

    /**
     * Get active employees count by department
     */
    async getActiveCountByDepartment(departmentId: number): Promise<number> {
        return await this.count({
            departmentId,
            isActive: true,
        });
    }
}