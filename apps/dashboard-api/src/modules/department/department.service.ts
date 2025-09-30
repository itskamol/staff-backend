import { Injectable } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { Department, Prisma } from '@prisma/client';
import { QueryDto } from '../../shared/dto/query.dto';
import { DataScope } from '@app/shared/auth';
import { CreateDepartmentDto, UpdateDepartmentDto } from '../../shared/dto';

@Injectable()
export class DepartmentService {
    constructor(private readonly departmentRepository: DepartmentRepository) {}

    async getDepartments(
        { search, isActive, sort, order, page, limit }: QueryDto,
        scope?: DataScope
    ) {
        const filters: Prisma.DepartmentWhereInput = {};
        if (search) {
            filters.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (typeof isActive === 'boolean') {
            filters.isActive = isActive;
        }

        const result = await this.departmentRepository.findManyWithPagination(
            filters,
            { [sort]: order },
            { _count: { select: { employees: true, children: true } } },
            { page, limit },
            scope,
        );

        return result;
    }

    async getDepartmentsWithScope(scope?: DataScope) {
        return this.departmentRepository.findMany(
            {},
            {},
            { _count: { select: { employees: true, children: true } } },
            undefined,
            undefined,
            scope
        );
    }

    async getDepartmentById(id: number, scope?: DataScope) {
        return this.departmentRepository.findById(
            id,
            {
                organization: true,
                parent: true,
                children: true,
                employees: true,
            },
            scope
        );
    }

    async createDepartment(
        { organizationId, parentId, ...data }: CreateDepartmentDto,
        scope: DataScope
    ): Promise<Department> {
        return this.departmentRepository.create(
            {
                ...data,
                organization: { connect: { id: organizationId } },
                ...(parentId && { parent: { connect: { id: parentId } } }),
            },
            undefined,
            scope
        );
    }

    async updateDepartment(id: number, data: UpdateDepartmentDto, scope?: DataScope) {
        return this.departmentRepository.update(id, data, undefined, scope);
    }

    async deleteDepartment(id: number, scope?: DataScope) {
        return this.departmentRepository.delete(id, scope);
    }
}
