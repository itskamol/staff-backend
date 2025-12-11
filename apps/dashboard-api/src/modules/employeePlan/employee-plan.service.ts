import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmployeePlanRepository } from './employee-plan.repository';
import {
    AssignEmployeesDto,
    CreateEmployeePlanDto,
    EmployeePlanQueryDto,
    UpdateEmployeePlanDto,
} from './employee-plan.dto';
import { DataScope, UserContext } from '@app/shared/auth';
import { EmployeeService } from '../employee/services/employee.service';

@Injectable()
export class EmployeePlanService {
    constructor(
        private readonly repo: EmployeePlanRepository,
        private readonly employeeService: EmployeeService
    ) {}

    async create(dto: CreateEmployeePlanDto, user: UserContext, scope: DataScope) {
        try {
            const orgId = dto.organizationId || scope.organizationId;
            dto.organizationId = orgId;
            return await this.repo.create({ ...dto }, undefined, scope);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    async findAll(query: EmployeePlanQueryDto, scope: DataScope) {
        const where: any = {};
        if (query.isActive !== undefined) where.isActive = query.isActive;

        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { addadditionalDetails: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query.organizationId) {
            where.organizationId = query.organizationId;
        }

        const orderBy = { [query.sort ?? 'id']: query.order ?? 'desc' };

        const data = await this.repo.findManyPlan({
            skip: ((query.page ?? 1) - 1) * (query.limit ?? 10),
            take: query.limit ?? 10,
            where,
            orderBy,
            scope,
        });

        const total = await this.repo.count(where, scope);

        return {
            data: data.map(item => ({ ...item, weekdays: item.weekdays?.split(',') ?? [] })),
            total,
            page: query.page ?? 1,
            limit: query.limit ?? 10,
        };
    }

    async findById(id: number, scope: DataScope) {
        const plan = await this.repo.findByIdOrThrow(
            id,
            {
                employees: {
                    select: {
                        id: true,
                        name: true,
                        photo: true,
                        department: { select: { fullName: true, shortName: true } },
                        phone: true,
                    },
                    where: { deletedAt: null },
                },
            },
            scope
        );
        return { ...plan, weekdays: plan.weekdays?.split(',') ?? [] };
    }

    async update(id: number, dto: UpdateEmployeePlanDto, scope: DataScope) {
        await this.findById(id, scope);

        if (scope?.organizationId) {
            dto.organizationId = scope?.organizationId;
        }

        const data = await this.repo.update(id, dto, undefined, scope);

        const result = { ...data, weekdays: data.weekdays?.split(',') ?? [] };
        return result;
    }

    async delete(id: number, scope: DataScope) {
        await this.findById(id, scope);
        return this.repo.softDelete(id, scope);
    }

    async assignEmployees(dto: AssignEmployeesDto, scope: DataScope, user: UserContext) {
        const plan = await this.findById(dto.employeePlanId, scope);

        if (plan.employees?.length) {
            const defaultPlan = await this.repo.findFirst({ isDefault: true }, {}, {}, scope);
            const ids = plan.employees.map(e => e.id);
            await this.employeeService.updateManyEmployees(
                ids,
                { employeePlanId: defaultPlan?.id ?? null },
                scope,
                user
            );
        }

        const employees = await this.employeeService.findByIds(dto.employeeIds, scope);
        const validIds = employees.map(e => e.id);
        const invalidIds = dto.employeeIds.filter(id => !validIds.includes(id));

        await this.repo.assignEmployees(dto.employeePlanId, validIds);

        return {
            message: `Assigned ${validIds.length} employees`,
            successfullyAssigned: employees,
            invalidIds,
        };
    }

    async findActivePlansForJob() {
        const plans = await this.repo.findMany(
            { isActive: true, deletedAt: null },
            { id: 'asc' },
            {
                employees: {
                    select: { id: true, organizationId: true },
                    where: { deletedAt: null },
                },
            }
        );

        return plans.map(plan => ({
            ...plan,
            weekdaysList: plan.weekdays ? plan.weekdays.split(',').map(d => d.trim()) : [],
        }));
    }
}
