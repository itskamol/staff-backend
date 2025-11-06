import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeePlanRepository } from './employee-plan.repository';
import { AssignEmployeesDto, CreateEmployeePlanDto, EmployeePlanQueryDto, UpdateEmployeePlanDto } from './employee-plan.dto';
import { PrismaService } from '@app/shared/database';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class EmployeePlanService {
    constructor(private readonly repo: EmployeePlanRepository,
        private readonly prisma: PrismaService,
    ) { }

    async create(
        dto: CreateEmployeePlanDto,
        user: UserContext,
        scope: DataScope) {

        try {
            console.log(dto)
            const organizationId = dto.organizationId ? dto.organizationId : scope.organizationId

            return this.repo.create({ ...dto, organizationId });
        } catch (error) {
            console.log(error)
            throw new BadRequestException({ message: error.message })
        }
    }

    async findAll(query: EmployeePlanQueryDto) {
        const where: any = {};
        if (query.isActive !== undefined) where.isActive = query.isActive;

        const orderBy: any = {};
        if (query.sortBy) {
            orderBy[query.sortBy] = query.sortOrder || 'asc';
        } else {
            orderBy.id = 'desc';
        }

        const data = await this.repo.findManyPlan({
            skip: query.page ?? 0,
            take: query.limit ?? 10,
            where,
            orderBy,
        });

        // Total count olish
        const total = await this.prisma.employeePlan.count({ where });

        return {
            data,
            total,
            page: query.page || 1,
            limit: query.limit || 10,
        };
    }

    async findById(id: number) {
        const plan = await this.repo.findById(id);
        if (!plan) throw new NotFoundException('Employee plan not found');
        return plan;
    }

    async update(id: number, dto: UpdateEmployeePlanDto) {
        await this.findById(id);
        return this.repo.update(id, dto);
    }

    async delete(id: number) {
        await this.findById(id);
        return this.repo.delete(id);
    }

    async assignEmployees(dto: AssignEmployeesDto) {
        await this.findById(dto.employeePlanId);

        const employees = await this.repo.findMany({
            where: { id: { in: dto.employeeIds } },
            select: { id: true, name: true, photo: true },
        });

        const validIds = employees.map(e => e.id);
        const invalidIds = dto.employeeIds.filter(id => !validIds.includes(id));

        await this.repo.assignEmployees(dto.employeePlanId, validIds);

        const successfullyAssigned = employees.filter(e => validIds.includes(e.id));

        return {
            message: `Assigned ${successfullyAssigned.length} employees`,
            successfullyAssigned,
            invalidIds,
        };
    }

}
