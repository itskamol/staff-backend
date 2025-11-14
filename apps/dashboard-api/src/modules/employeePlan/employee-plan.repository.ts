import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { CreateEmployeePlanDto, UpdateEmployeePlanDto } from './employee-plan.dto';
import { Prisma } from '@prisma/client';


@Injectable()
export class EmployeePlanRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: CreateEmployeePlanDto) {
        return this.prisma.employeePlan.create({ data });
    }

    async findAll() {
        return this.prisma.employeePlan.findMany({
            include: { employees: true },
            orderBy: { id: 'desc' },
        });
    }

    async findOne(query: Prisma.EmployeePlanWhereInput) {
        return this.prisma.employeePlan.findFirst({ where: query })
    }

    async findById(id: string) {
        return this.prisma.employeePlan.findUnique({
            where: { id },
            include: { employees: true },
        });
    }

    async update(id: string, data: UpdateEmployeePlanDto) {
        return this.prisma.employeePlan.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.employeePlan.delete({ where: { id } });
    }

    async assignEmployees(employeePlanId: string, employeeIds: string[]) {

        return this.prisma.employee.updateMany({
            where: { id: { in: employeeIds } },
            data: { employeePlanId },
        });
    }

    async findMany(params: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
        select?: any;
        include?: any;
    }) {
        const { skip = 0, take = 50, where = {}, orderBy = { id: 'asc' }, select, include } = params;

        const args: any = { skip, take, where, orderBy };
        if (select) args.select = select;
        else if (include) args.include = include;

        return this.prisma.employee.findMany(args);
    }

    async findManyPlan(params: {
        skip?: number;
        take?: number;
        where?: any;
        orderBy?: any;
        include?: any;
    }) {
        const { skip = 0, take = 10, where = {}, orderBy = { id: 'desc' }, include } = params;

        return this.prisma.employeePlan.findMany(
            {
                skip,
                take,
                where,
                orderBy,
                include: include ?? {
                    employees: {
                        select: {
                            id: true,
                            name: true,
                            photo: true,
                        },
                    },
                    organization: {
                        select: {
                            fullName: true
                        }
                    }
                },
            }
        );
    }
}