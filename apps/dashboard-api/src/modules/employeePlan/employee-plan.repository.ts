import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { CreateEmployeePlanDto, UpdateEmployeePlanDto } from './employee-plan.dto';


@Injectable()
export class EmployeePlanRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: CreateEmployeePlanDto) {
        return this.prisma.employeePlan.create({ data });
    }

    async findAll() {
        return this.prisma.employeePlan.findMany({
            include: { Employee: true },
            orderBy: { id: 'desc' },
        });
    }

    async findById(id: number) {
        return this.prisma.employeePlan.findUnique({
            where: { id },
            include: { Employee: true },
        });
    }

    async update(id: number, data: UpdateEmployeePlanDto) {
        return this.prisma.employeePlan.update({
            where: { id },
            data,
        });
    }

    async delete(id: number) {
        return this.prisma.employeePlan.delete({ where: { id } });
    }

    async assignEmployees(employeePlanId: number, employeeIds: number[]) {
        // har bir xodimni employeePlanId bilan update qilish
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

        // Prisma faqat bittasini qabul qiladi: select yoki include
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
                    Employee: {
                        select: {
                            id: true,
                            name: true,
                            photo: true,
                        },
                    },
                },
            }
        );
    }
}