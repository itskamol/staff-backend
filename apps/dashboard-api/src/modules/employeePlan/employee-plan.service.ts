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
import { formatInTimeZone, getUtcDayRange, TimezoneUtil } from '@app/shared/utils';
import { Prisma } from '@prisma/client';

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

            const input: Prisma.EmployeePlanCreateInput = {
                ...dto,
                startTimeInSeconds: this.parseTimeFromString(dto.startTime),
                endTimeInSeconds: this.parseTimeFromString(dto.endTime),
                extraTimeInSeconds: this.parseTimeFromString(dto.extraTime),
            };

            console.log(input)

            return await this.repo.create({ ...input }, undefined, scope);
        } catch (error) {
            throw new BadRequestException(error.message);
        }
    }

    private parseTimeFromString(timeStr?: string): number {
        const date = new Date();
        const mills =  this.parseStrToTime(timeStr);
        console.log(mills)
        date.setMilliseconds(mills);
        const dateTime = formatInTimeZone(date, TimezoneUtil.DEFAULT_TIME_ZONE, 'HH:mm');

        return this.parseStrToTime(dateTime);
    }

    private parseStrToTime(str: string): number {
        const [hour, minute] = str ? str.split(':').map(Number) : [0, 0];

        return hour * 3600 * 1000 + minute * 60 * 1000;
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

        const orderBy = { [query.sortBy ?? 'id']: query.sortOrder ?? 'desc' };

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
        const plan = await this.repo.findByIdOrThrow(id, { employees: true }, scope);
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
        return this.repo.delete(id, scope);
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
            { isActive: true },
            { id: 'asc' },
            {
                employees: { select: { id: true } },
                organization: { select: { id: true, defaultTimeZone: true } },
            }
        );

        return plans.map(plan => {
            const weekdaysList = plan.weekdays ? plan.weekdays.split(',').map(d => d.trim()) : [];

            const timeZone = plan.organization?.defaultTimeZone ?? TimezoneUtil.DEFAULT_TIME_ZONE;

            return {
                ...plan,
                weekdaysList,
                timeZone,
            };
        });
    }
}
