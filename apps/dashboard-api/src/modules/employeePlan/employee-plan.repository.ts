import { Injectable } from '@nestjs/common';
import { Prisma, EmployeePlan, Employee } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { BaseRepository } from '../../shared/repositories/base.repository';
import { DataScope } from '@app/shared/auth';

type EmployeePlanWithEmployees = EmployeePlan & {
    employees?: Employee[];
};

@Injectable()
export class EmployeePlanRepository extends BaseRepository<
    EmployeePlanWithEmployees,
    Prisma.EmployeePlanCreateInput,
    Prisma.EmployeePlanUpdateInput,
    Prisma.EmployeePlanWhereInput,
    Prisma.EmployeePlanWhereUniqueInput,
    Prisma.EmployeePlanOrderByWithRelationInput,
    Prisma.EmployeePlanInclude
> {
    protected readonly modelName = Prisma.ModelName.EmployeePlan;

    protected disconnectRelations = ['employees'];

    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.employeePlan;
    }

    /**
     * Assign employees to a plan
     */
    async assignEmployees(employeePlanId: number, employeeIds: number[]) {
        return this.prisma.employee.updateMany({
            where: { id: { in: employeeIds } },
            data: { employeePlanId },
        });
    }

    /**
     * Find many plans with default include
     */
    async findManyPlan(params: {
        skip?: number;
        take?: number;
        where?: Prisma.EmployeePlanWhereInput;
        orderBy?: Prisma.EmployeePlanOrderByWithRelationInput;
        include?: Prisma.EmployeePlanInclude;
        scope?: DataScope; // DataScope
    }) {
        const {
            skip = 0,
            take = 10,
            where = {},
            orderBy = { id: 'desc' },
            include,
            scope,
        } = params;

        return this.findMany(
            where,
            orderBy,
            include ?? {
                employees: {
                    select: { id: true, name: true, photo: true },
                    where: { deletedAt: null },
                },
                organization: { select: { fullName: true } },
            },
            { page: Math.floor(skip / take) + 1, limit: take },
            undefined,
            scope
        );
    }
}
