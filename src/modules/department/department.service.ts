import { Injectable } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { DataScope } from '@/shared/interfaces';
import { Department, Prisma } from '@prisma/client';
import { CreateDepartmentDto, UpdateDepartmentDto } from '@/shared/dto';
import { QueryDto } from '@/shared/dto/query.dto';

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

        const [data, total] = await Promise.all([
            this.departmentRepository.findMany(
                filters,
                { [sort]: order },
                { _count: { select: { employees: true, children: true } } },
                { page, limit },
                scope
            ),
            this.departmentRepository.count(filters, scope),
        ]);

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async getDepartmentById(id: number, scope?: DataScope) {
        return this.departmentRepository.findById(id, { 
            organization: true, 
            parent: true, 
            children: true, 
            employees: true 
        }, scope);
    }

    async createDepartment(data: CreateDepartmentDto): Promise<Department> {
        return this.departmentRepository.create({
            ...data,
            organization: { connect: { id: data.organizationId } },
            ...(data.parentId && { parent: { connect: { id: data.parentId } } })
        });
    }

    async updateDepartment(id: number, data: UpdateDepartmentDto, scope?: DataScope) {
        return this.departmentRepository.update(id, data, undefined, scope);
    }

    async deleteDepartment(id: number, scope?: DataScope) {
        return this.departmentRepository.delete(id, scope);
    }
}
