import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { UpdateComputerUserDto } from '../dto/computer-user.dto';
import { UserContext } from '../../../shared/interfaces';
import { ComputerUserRepository } from '../repositories/computer-user.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class ComputerUserService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly computerUserRepository: ComputerUserRepository
    ) {}

    async findAll(
        query: QueryDto & { linked?: string; computerId?: number },
        scope: DataScope,
        user: UserContext
    ) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            linked,
            computerId,
        } = query;
        const where: Prisma.ComputerUserWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { domain: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (linked === 'true') {
            where.employeeId = { not: null };
        } else if (linked === 'false') {
            where.employeeId = null;
        }

        if (computerId) {
            where.id = computerId;
        }

        return this.computerUserRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        department: {
                            select: {
                                id: true,
                                fullName: true,
                                shortName: true,
                            },
                        },
                    },
                },
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
                    department: {
                        select: { id: true, fullName: true, shortName: true },
                    },
                },
            },
            usersOnComputers: {
                include: { computer: true },
            },
        });

        if (!computerUser) {
            throw new NotFoundException('Computer user not found');
        }

        return computerUser;
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
            usersOnComputers: {
                include: { computer: true },
            },
        });
    }

    async linkEmployee(id: number, employeeId: number, user: UserContext) {
        const computerUser = await this.findOne(id, user);

        if (computerUser.employeeId) {
            throw new BadRequestException('Computer user is already linked to an employee');
        }

        // Verify employee exists
        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
        });

        if (!employee) {
            throw new NotFoundException('Employee not found');
        }

        return this.computerUserRepository.linkEmployee(id, employeeId);
    }

    async unlinkEmployee(id: number, user: UserContext) {
        const computerUser = await this.findOne(id, user);

        if (!computerUser.employeeId) {
            throw new BadRequestException('Computer user is not linked to any employee');
        }

        return this.computerUserRepository.unlinkEmployee(id);
    }

    async findByEmployeeId(employeeId: number) {
        return this.computerUserRepository.findByEmployeeId(employeeId, {
            usersOnComputers: {
                include: { computer: true },
            },
        });
    }
}
