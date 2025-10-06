import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { EmployeeGroup, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class EmployeeGroupRepository extends BaseRepository<
    EmployeeGroup,
    Prisma.EmployeeGroupCreateInput,
    Prisma.EmployeeGroupUpdateInput,
    Prisma.EmployeeGroupWhereInput,
    Prisma.EmployeeGroupWhereUniqueInput,
    Prisma.EmployeeGroupOrderByWithRelationInput,
    Prisma.EmployeeGroupInclude,
    Prisma.EmployeeGroupSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.EmployeeGroup;

    protected getDelegate() {
        return this.prisma.employeeGroup;
    }

    /**
     * Find default group for an organization
     */
    async findDefaultByOrganization(organizationId: number) {
        return this.findFirst({
            organizationId,
            isDefault: true,
        });
    }

    /**
     * Find all groups for an organization
     */
    async findByOrganization(
        organizationId: number,
        include?: Prisma.EmployeeGroupInclude
    ) {
        return this.findMany(
            { organizationId },
            { name: 'asc' },
            include
        );
    }

    /**
     * Check if group exists by name in organization
     */
    async existsByName(organizationId: number, name: string, excludeId?: number) {
        const where: Prisma.EmployeeGroupWhereInput = {
            organizationId,
            name: {
                equals: name,
                mode: 'insensitive',
            },
        };

        if (excludeId) {
            where.id = { not: excludeId };
        }

        const group = await this.findFirst(where);
        return !!group;
    }

    /**
     * Count employees in a group
     */
    async countEmployees(groupId: number): Promise<number> {
        const count = await this.prisma.employee.count({
            where: { groupId },
        });

        return count;
    }
}
