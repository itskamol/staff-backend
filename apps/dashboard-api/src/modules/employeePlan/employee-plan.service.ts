import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeePlanRepository } from './employee-plan.repository';
import { AssignEmployeesDto, CreateEmployeePlanDto, EmployeePlanQueryDto, UpdateEmployeePlanDto } from './employee-plan.dto';
import { PrismaService } from '@app/shared/database';
import { DataScope, UserContext } from '@app/shared/auth';
import { EmployeeService } from '../employee/services/employee.service';

@Injectable()
export class EmployeePlanService {
    constructor(private readonly repo: EmployeePlanRepository,
        private readonly prisma: PrismaService,
        private readonly employeeService: EmployeeService
    ) { }

    async create(
        dto: CreateEmployeePlanDto,
        user: UserContext,
        scope: DataScope) {

        try {
            const organizationId = dto.organizationId ? dto.organizationId : scope.organizationId
            return this.repo.create({ ...dto, organizationId });
        } catch (error) {
            throw new BadRequestException({ message: error.message })
        }
    }

    async findAll(query: EmployeePlanQueryDto) {
        const where: any = {};
        if (query.isActive !== undefined) where.isActive = query.isActive;

        let search = query.search

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { addadditionalDetails: { contains: search, mode: 'insensitive' } },
            ];
        }

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

    async assignEmployees(dto: AssignEmployeesDto, scope:DataScope, user: UserContext ) {
        const plan = await this.findById(dto.employeePlanId);

        if (plan.employees && plan.employees.length) {
            const defaultPlan = await this.repo.findOne({ isDefault: true });
            const ids = plan.employees.map(e => e.id)
            
            // TODD: Update Many from employeeService
            const dto = {
                employeePlanId: defaultPlan?.id || null
            }
            await this.employeeService.updateManyEmployees(ids,dto, scope, user);
        }

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
