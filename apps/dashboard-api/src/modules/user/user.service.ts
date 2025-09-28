import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import { EncryptionUtil, QueryBuilderUtil, PaginationDto } from '@app/shared/utils';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(paginationDto: PaginationDto) {
        const query = QueryBuilderUtil.buildQuery(paginationDto);

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                ...query,
                select: {
                    id: true,
                    name: true,
                    username: true,
                    role: true,
                    organizationId: true,
                    isActive: true,
                    createdAt: true,
                    updatedAt: true,
                    organization: {
                        select: {
                            id: true,
                            fullName: true,
                            shortName: true,
                        },
                    },
                    departmentUsers: {
                        select: {
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
            }),
            this.prisma.user.count({ where: query.where }),
        ]);

        return QueryBuilderUtil.buildResponse(
            users,
            total,
            paginationDto.page || 1,
            paginationDto.limit || 10
        );
    }

    async findOne(id: number) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                organizationId: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                organization: {
                    select: {
                        id: true,
                        fullName: true,
                        shortName: true,
                    },
                },
                departmentUsers: {
                    select: {
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
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async create(createUserDto: CreateUserDto) {
        const { username, password, ...userData } = createUserDto;

        // Check if username already exists
        const existingUser = await this.prisma.user.findUnique({
            where: { username },
        });

        if (existingUser) {
            throw new ConflictException('Username already exists');
        }

        if (!createUserDto.organizationId) {
            await this.prisma.organization.findFirst({
                where: { id: createUserDto.organizationId },
            });
        }

        // Hash password
        const hashedPassword = await EncryptionUtil.hashPassword(password);

        const user = await this.prisma.user.create({
            data: {
                ...userData,
                username,
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                organizationId: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return user;
    }

    async update(id: number, updateUserDto: UpdateUserDto) {
        const { password, ...userData } = updateUserDto;

        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        // Prepare update data
        const updateData: any = { ...userData };

        // Hash password if provided
        if (password) {
            updateData.password = await EncryptionUtil.hashPassword(password);
        }

        const user = await this.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                organizationId: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return user;
    }

    async remove(id: number) {
        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        // Soft delete by setting isActive to false
        await this.prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async assignOrganization(id: number, organizationId: number) {
        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        // Check if organization exists
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization) {
            throw new NotFoundException('Organization not found');
        }

        const user = await this.prisma.user.update({
            where: { id },
            data: { organizationId },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                organizationId: true,
                isActive: true,
                organization: {
                    select: {
                        id: true,
                        fullName: true,
                        shortName: true,
                    },
                },
            },
        });

        return user;
    }

    async changeRole(id: number, role: Role) {
        // Check if user exists
        const existingUser = await this.prisma.user.findUnique({
            where: { id },
        });

        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        const user = await this.prisma.user.update({
            where: { id },
            data: { role },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                organizationId: true,
                isActive: true,
            },
        });

        return user;
    }
}
