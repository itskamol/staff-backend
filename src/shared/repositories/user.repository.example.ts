import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '@/core/database/prisma.service';
import { BaseRepository } from './base.repository';
import { DataScope } from '@/shared/interfaces/data-scope.interface';

/**
 * Example implementation of BaseRepository for User entity
 * Demonstrates best practices for repository implementation
 */
@Injectable()
export class UserRepositoryExample extends BaseRepository<
    User,
    Prisma.UserCreateInput,
    Prisma.UserUpdateInput,
    Prisma.UserWhereInput,
    Prisma.UserWhereUniqueInput,
    Prisma.UserOrderByWithRelationInput,
    Prisma.UserInclude
> {
    protected readonly modelName = Prisma.ModelName.User

    constructor(prisma: PrismaService) {
        super(prisma);
    }

    /**
     * Get the Prisma delegate for User model
     */
    protected getDelegate() {
        return this.prisma.user;
    }

    /**
     * Find user by username (business logic specific method)
     */
    async findByUsername(
        username: string, 
        include?: Prisma.UserInclude,
        scope?: DataScope
    ): Promise<User | null> {
        return this.findFirst(
            { username },
            undefined,
            include,
            scope
        );
    }

    /**
     * Find active users by role
     */
    async findActiveByRole(
        role: Role,
        include?: Prisma.UserInclude,
        scope?: DataScope
    ): Promise<User[]> {
        return this.findManyActive(
            { role },
            { createdAt: 'desc' },
            include,
            undefined,
            scope
        );
    }

    /**
     * Find users by department with pagination
     */
    async findByDepartmentWithPagination(
        departmentId: number,
        pagination = { page: 1, limit: 10 },
        include?: Prisma.UserInclude,
        scope?: DataScope
    ) {
        return this.findManyActiveWithPagination(
            { departmentId },
            { name: 'asc' },
            include,
            pagination,
            scope
        );
    }

    /**
     * Find users by organization
     */
    async findByOrganization(
        organizationId: number,
        include?: Prisma.UserInclude,
        scope?: DataScope
    ): Promise<User[]> {
        return this.findManyActive(
            { organizationId },
            { name: 'asc' },
            include,
            undefined,
            scope
        );
    }

    /**
     * Update user password (specific business logic)
     */
    async updatePassword(
        id: number,
        hashedPassword: string,
        scope?: DataScope
    ): Promise<User> {
        return this.update(
            id,
            { password: hashedPassword },
            undefined,
            scope
        );
    }

    /**
     * Deactivate user (soft delete with business logic)
     */
    async deactivateUser(id: number, scope?: DataScope): Promise<User> {
        return this.softDelete(id, scope);
    }

    /**
     * Activate user
     */
    async activateUser(id: number, scope?: DataScope): Promise<User> {
        return this.update(
            id,
            { isActive: true },
            undefined,
            scope
        );
    }

    /**
     * Create user with organization and department scope
     */
    async createUser(
        userData: Omit<Prisma.UserCreateInput, 'organization' | 'department'>,
        scope: DataScope
    ): Promise<User> {
        const createData: Prisma.UserCreateInput = {
            ...userData,
            organization: scope.organizationId ? {
                connect: { id: Number(scope.organizationId) }
            } : undefined,
            department: scope.departmentId ? {
                connect: { id: Number(scope.departmentId) }
            } : undefined,
        };

        return this.create(createData, undefined, scope);
    }

    /**
     * Find users with their organization and department details
     */
    async findUsersWithDetails(
        where?: Prisma.UserWhereInput,
        pagination = { page: 1, limit: 10 },
        scope?: DataScope
    ) {
        const include: Prisma.UserInclude = {
            organization: true,
            department: true,
        };

        return this.findManyActiveWithPagination(
            where,
            { createdAt: 'desc' },
            include,
            pagination,
            scope
        );
    }

    /**
     * Count users by role in organization
     */
    async countUsersByRoleInOrganization(
        role: Role,
        organizationId: number,
        scope?: DataScope
    ): Promise<number> {
        return this.count(
            { 
                role,
                organizationId,
                isActive: true 
            },
            scope
        );
    }

    /**
     * Bulk update users in department
     */
    async updateUsersInDepartment(
        departmentId: number,
        updateData: Prisma.UserUpdateInput,
        scope?: DataScope
    ): Promise<{ count: number }> {
        return this.updateMany(
            { departmentId },
            updateData,
            scope
        );
    }
}