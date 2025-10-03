import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreateComputerUserDto, UpdateComputerUserDto } from '../dto/computer-user.dto';
import { UserContext } from '../../../shared/interfaces';
import { ComputerUserRepository } from '../repositories/computer-user.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class ComputerUserService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly computerUserRepository: ComputerUserRepository
    ) {}

    async findAll(query: QueryDto & { linked?: string; computer_id?: string }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, linked, computer_id } = query;
        const where: Prisma.ComputerUserWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { domain: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (linked === 'true') {
            where.employee_id = { not: null };
        } else if (linked === 'false') {
            where.employee_id = null;
        }

        if (computer_id) {
            where.computer_id = parseInt(computer_id);
        }

        return this.computerUserRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        sub_department: {
                            select: {
                                id: true,
                                full_name: true,
                                department: {
                                    select: {
                                        id: true,
                                        full_name: true,
                                        organization: {
                                            select: {
                                                id: true,
                                                full_name: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                computer: {
                    select: {
                        id: true,
                        computer_id: true,
                        os: true,
                        ip_address: true,
                        mac_address: true
                    }
                }
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const computerUser = await this.computerUserRepository.findById(id, {
            employee: {
                select: {
                    id: true,
                    name: true,
                    personal_id: true,
                    sub_department: {
                        select: {
                            id: true,
                            full_name: true,
                            department: {
                                select: {
                                    id: true,
                                    full_name: true,
                                    organization: {
                                        select: {
                                            id: true,
                                            full_name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            computer: {
                select: {
                    id: true,
                    computer_id: true,
                    os: true,
                    ip_address: true,
                    mac_address: true
                }
            },
            activeWindows: {
                take: 10,
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    process_name: true,
                    window_title: true,
                    created_at: true
                }
            },
            visitedSites: {
                take: 10,
                orderBy: { created_at: 'desc' },
                select: {
                    id: true,
                    url: true,
                    title: true,
                    created_at: true
                }
            }
        });

        if (!computerUser) {
            throw new NotFoundException('Computer user not found');
        }

        return computerUser;
    }

    async create(createComputerUserDto: CreateComputerUserDto, scope: DataScope) {
        // Check if SID already exists
        const existing = await this.computerUserRepository.findBySid(createComputerUserDto.sid_id);
        if (existing) {
            throw new BadRequestException('Computer user with this SID already exists');
        }

        return this.computerUserRepository.create({
            sid_id: createComputerUserDto.sid_id,
            name: createComputerUserDto.name,
            domain: createComputerUserDto.domain,
            username: createComputerUserDto.username,
            is_admin: createComputerUserDto.is_admin,
            is_in_domain: createComputerUserDto.is_in_domain,
            is_active: createComputerUserDto.is_active,
            computer: {
                connect: { id: createComputerUserDto.computer_id }
            }
        }, undefined, scope);
    }

    async update(id: number, updateComputerUserDto: UpdateComputerUserDto, user: UserContext) {
        await this.findOne(id, user);

        return this.computerUserRepository.update(id, updateComputerUserDto);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const computerUser = await this.computerUserRepository.findById(id, undefined, scope);

        if (!computerUser) {
            throw new NotFoundException('Computer user not found');
        }

        return this.computerUserRepository.delete(id, scope);
    }

    async findUnlinked(scope: DataScope) {
        return this.computerUserRepository.findUnlinked({
            computer: {
                select: {
                    id: true,
                    computer_id: true,
                    os: true,
                    ip_address: true,
                    mac_address: true
                }
            }
        });
    }

    async linkEmployee(id: number, employeeId: number, user: UserContext) {
        const computerUser = await this.findOne(id, user);
        
        if (computerUser.employee_id) {
            throw new BadRequestException('Computer user is already linked to an employee');
        }

        // Verify employee exists
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId }
        });

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        return this.computerUserRepository.linkEmployee(id, employeeId);
    }

    async unlinkEmployee(id: number, user: UserContext) {
        const computerUser = await this.findOne(id, user);
        
        if (!computerUser.employee_id) {
            throw new BadRequestException('Computer user is not linked to any employee');
        }

        return this.computerUserRepository.unlinkEmployee(id);
    }

    async findByEmployeeId(employeeId: number) {
        return this.computerUserRepository.findByEmployeeId(employeeId, {
            computer: {
                select: {
                    id: true,
                    computer_id: true,
                    os: true,
                    ip_address: true,
                    mac_address: true
                }
            }
        });
    }
}