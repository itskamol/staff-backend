import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import { QueryBuilderUtil, PaginationDto } from '@app/shared/utils';
import { CreateEmployeeDto, UpdateEmployeeDto, LinkComputerUserDto } from './dto/employee.dto';

@Injectable()
export class EmployeeService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(paginationDto: PaginationDto, user: any) {
        const query = QueryBuilderUtil.buildQuery(paginationDto);

        // Apply role-based filtering
        if (user.role === Role.HR) {
            // HR can see employees from their organization
            query.where.department = {
                organizationId: user.organizationId,
            };
        } else if (user.role === Role.DEPARTMENT_LEAD) {
            // Department lead can see employees from their departments
            query.where.departmentId = { in: user.departmentIds || [] };
        } else if (user.role === Role.GUARD) {
            // Guard can see basic employee info for entry/exit
            // No additional filtering needed, but limited fields
        }

        const [employees, totalRecords] = await Promise.all([
            this.prisma.employee.findMany({
                ...query,
                select: {
                    id: true,
                    name: true,
                    address: true,
                    phone: true,
                    email: true,
                    photo: true,
                    additionalDetails: user.role === Role.GUARD ? false : true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    department: {
                        select: {
                            id: true,
                            fullName: true,
                            shortName: true,
                            organization: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    shortName: true,
                                },
                            },
                        },
                    },
                    policy:
                        user.role === Role.GUARD
                            ? false
                            : {
                                  select: {
                                      id: true,
                                      title: true,
                                  },
                              },
                    _count:
                        user.role === Role.GUARD
                            ? false
                            : {
                                  select: {
                                      computerUsers: true,
                                      credentials: true,
                                      actions: true,
                                  },
                              },
                },
            }),
            this.prisma.employee.count({ where: query.where }),
        ]);

        return QueryBuilderUtil.buildResponse(
            employees,
            totalRecords,
            paginationDto.page || 1,
            paginationDto.limit || 10
        );
    }

    async findOne(id: number, user: any) {
        const employee = await this.prisma.employee.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                email: true,
                photo: true,
                additionalDetails: user.role === Role.GUARD ? false : true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                department: {
                    select: {
                        id: true,
                        fullName: true,
                        shortName: true,
                        organizationId: true,
                        organization: {
                            select: {
                                id: true,
                                fullName: true,
                                shortName: true,
                            },
                        },
                    },
                },
                policy:
                    user.role === Role.GUARD
                        ? false
                        : {
                              select: {
                                  id: true,
                                  title: true,
                                  activeWindow: true,
                                  screenshot: true,
                                  visitedSites: true,
                              },
                          },
                computerUsers:
                    user.role === Role.GUARD
                        ? false
                        : {
                              select: {
                                  id: true,
                                  sid: true,
                                  name: true,
                                  domain: true,
                                  username: true,
                                  isAdmin: true,
                                  isInDomain: true,
                              },
                          },
                credentials:
                    user.role === Role.GUARD
                        ? false
                        : {
                              select: {
                                  id: true,
                                  code: true,
                                  type: true,
                                  isActive: true,
                              },
                          },
            },
        });

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        // Check access permissions
        if (user.role === Role.HR && employee.department.organizationId !== user.organizationId) {
            throw new ForbiddenException('Access denied to this employee');
        }

        if (
            user.role === Role.DEPARTMENT_LEAD &&
            !user.departmentIds?.includes(employee.department.id)
        ) {
            throw new ForbiddenException('Access denied to this employee');
        }

        return employee;
    }

    async create(createEmployeeDto: CreateEmployeeDto, user: any) {
        // Check if department exists and access permissions
        const department = await this.prisma.department.findUnique({
            where: { id: createEmployeeDto.departmentId },
            select: {
                id: true,
                organizationId: true,
            },
        });

        if (!department) {
            throw new NotFoundException('Department not found');
        }

        // Check access permissions
        if (user.role === Role.HR && department.organizationId !== user.organizationId) {
            throw new ForbiddenException('Cannot create employee in different organization');
        }

        const employee = await this.prisma.employee.create({
            data: createEmployeeDto,
            select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                email: true,
                photo: true,
                additionalDetails: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                department: {
                    select: {
                        id: true,
                        fullName: true,
                        shortName: true,
                        organization: {
                            select: {
                                id: true,
                                fullName: true,
                                shortName: true,
                            },
                        },
                    },
                },
            },
        });

        return employee;
    }

    async update(id: number, updateEmployeeDto: UpdateEmployeeDto, user: any) {
        // Check if employee exists and access permissions
        const existingEmployee = await this.findOne(id, user);

        const employee = await this.prisma.employee.update({
            where: { id },
            data: updateEmployeeDto,
            select: {
                id: true,
                name: true,
                address: true,
                phone: true,
                email: true,
                photo: true,
                additionalDetails: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                department: {
                    select: {
                        id: true,
                        fullName: true,
                        shortName: true,
                        organization: {
                            select: {
                                id: true,
                                fullName: true,
                                shortName: true,
                            },
                        },
                    },
                },
            },
        });

        return employee;
    }

    async remove(id: number, user: any) {
        // Check if employee exists and access permissions
        await this.findOne(id, user);

        // Check if employee has dependencies
        const employeeWithDeps = await this.prisma.employee.findUnique({
            where: { id },
            include: {
                computerUsers: true,
                credentials: true,
                actions: true,
            },
        });

        if (
            employeeWithDeps?.computerUsers.length ||
            employeeWithDeps?.credentials.length ||
            employeeWithDeps?.actions.length
        ) {
            // Soft delete
            await this.prisma.employee.update({
                where: { id },
                data: { isActive: false },
            });
        } else {
            // Hard delete
            await this.prisma.employee.delete({
                where: { id },
            });
        }
    }

    async getComputerUsers(id: number, user: any) {
        // Check access permissions first
        await this.findOne(id, user);

        const computerUsers = await this.prisma.computerUser.findMany({
            where: { employeeId: id },
            select: {
                id: true,
                sid: true,
                name: true,
                domain: true,
                username: true,
                isAdmin: true,
                isInDomain: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        usersOnComputers: true,
                    },
                },
            },
        });

        return computerUsers;
    }

    async linkComputerUser(id: number, linkDto: LinkComputerUserDto, user: any) {
        // Check access permissions first
        await this.findOne(id, user);

        // Check if computer user exists
        const computerUser = await this.prisma.computerUser.findUnique({
            where: { id: linkDto.computerUserId },
        });

        if (!computerUser) {
            throw new NotFoundException('Computer user not found');
        }

        // Check if already linked to another employee
        if (computerUser.employeeId && computerUser.employeeId !== id) {
            throw new ConflictException('Computer user is already linked to another employee');
        }

        // Link computer user to employee
        const updatedComputerUser = await this.prisma.computerUser.update({
            where: { id: linkDto.computerUserId },
            data: { employeeId: id },
            select: {
                id: true,
                sid: true,
                name: true,
                domain: true,
                username: true,
                isAdmin: true,
                isInDomain: true,
                employee: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return updatedComputerUser;
    }

    async unlinkComputerUser(id: number, computerUserId: number, user: any) {
        // Check access permissions first
        await this.findOne(id, user);

        // Check if computer user exists and is linked to this employee
        const computerUser = await this.prisma.computerUser.findUnique({
            where: { id: computerUserId },
        });

        if (!computerUser) {
            throw new NotFoundException('Computer user not found');
        }

        if (computerUser.employeeId !== id) {
            throw new ConflictException('Computer user is not linked to this employee');
        }

        // Unlink computer user from employee
        await this.prisma.computerUser.update({
            where: { id: computerUserId },
            data: { employeeId: null },
        });
    }

    async getEntryLogs(id: number, paginationDto: PaginationDto, user: any) {
        // Check access permissions first
        await this.findOne(id, user);

        const query = QueryBuilderUtil.buildQuery(paginationDto);
        query.where.employeeId = id;

        const [actions, totalRecords] = await Promise.all([
            this.prisma.action.findMany({
                where: query.where,
                skip: query.skip,
                take: query.take,
                orderBy: { actionTime: 'desc' },
                select: {
                    id: true,
                    actionTime: true,
                    entryType: true,
                    actionType: true,
                    actionResult: true,
                    actionMode: true,
                    device: {
                        select: {
                            id: true,
                            name: true,
                            gate: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.action.count({ where: query.where }),
        ]);

        return QueryBuilderUtil.buildResponse(
            actions,
            totalRecords,
            paginationDto.page || 1,
            paginationDto.limit || 10
        );
    }

    async getActivityReport(id: number, paginationDto: PaginationDto, user: any) {
        // Check access permissions first
        const employee = await this.findOne(id, user);

        // Get computer users for this employee
        const computerUsers = await this.prisma.computerUser.findMany({
            where: { employeeId: id },
            select: { id: true },
        });

        if (computerUsers.length === 0) {
            return QueryBuilderUtil.buildResponse(
                [],
                0,
                paginationDto.page || 1,
                paginationDto.limit || 10
            );
        }

        const computerUserIds = computerUsers.map(cu => cu.id);

        // Get users on computers
        const usersOnComputers = await this.prisma.usersOnComputers.findMany({
            where: { computerUserId: { in: computerUserIds } },
            select: { id: true },
        });

        if (usersOnComputers.length === 0) {
            return QueryBuilderUtil.buildResponse(
                [],
                0,
                paginationDto.page || 1,
                paginationDto.limit || 10
            );
        }

        const usersOnComputersIds = usersOnComputers.map(uoc => uoc.id);

        const query = QueryBuilderUtil.buildQuery(paginationDto);
        query.where.usersOnComputersId = { in: usersOnComputersIds };

        // Get activity data (active windows, visited sites, etc.)
        const [activities, totalRecords] = await Promise.all([
            this.prisma.activeWindow.findMany({
                where: query.where,
                skip: query.skip,
                take: query.take,
                orderBy: { datetime: 'desc' },
                select: {
                    id: true,
                    datetime: true,
                    title: true,
                    processName: true,
                    activeTime: true,
                    usersOnComputers: {
                        select: {
                            computerUser: {
                                select: {
                                    name: true,
                                    username: true,
                                },
                            },
                            computer: {
                                select: {
                                    computerUid: true,
                                    ipAddress: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.activeWindow.count({ where: query.where }),
        ]);

        return QueryBuilderUtil.buildResponse(
            activities,
            totalRecords,
            paginationDto.page || 1,
            paginationDto.limit || 10
        );
    }
}
