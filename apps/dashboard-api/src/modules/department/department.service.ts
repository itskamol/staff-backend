import { ConflictException, Injectable } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { Department, Prisma } from '@prisma/client';
import { DataScope } from '@app/shared/auth';
import { CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from './dto';

@Injectable()
export class DepartmentService {
    constructor(private readonly departmentRepository: DepartmentRepository) {}

    async getDepartments(query: DepartmentQueryDto, scope?: DataScope) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            isActive,
            organizationId,
            parentId,
            isDeleted,
        } = query;

        const filters: Prisma.DepartmentWhereInput = {};
        if (search) {
            filters.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (parentId) {
            filters.parentId = parentId;
        }

        if (!isDeleted) {
            filters.deletedAt = null;
        }

        if (typeof isActive === 'boolean') {
            filters.isActive = isActive;
        }

        if (organizationId) {
            filters.organizationId = organizationId;
        }

        const result = await this.departmentRepository.findManyWithPagination(
            filters,
            { [sort]: order },
            {
                childrens: true,
                _count: { select: { employees: true, childrens: true } },
            },
            { page, limit },
            scope
        );

        return result;
    }

    async getDepartmentsWithScope(scope?: DataScope) {
        return this.departmentRepository.findMany(
            {},
            {},
            {
                childrens: true,
                _count: { select: { employees: true, childrens: true } },
            },
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
                childrens: true,
                employees: true,
            },
            scope
        );
    }

    async createDepartment(
        { organizationId, parentId, ...data }: CreateDepartmentDto,
        scope: DataScope
    ): Promise<Department> {
        const orgId = organizationId || scope.organizationId;

        const exsists = await this.departmentRepository.findUnique({
            org_dept_shortname_unique: { shortName: data.shortName, organizationId: orgId },
        });

        if (exsists) throw new ConflictException('shortname already exists this organization');

        return this.departmentRepository.create({
            ...data,
            organization: {
                connect: { id: orgId },
            },
            ...(parentId && { parent: { connect: { id: parentId } } }),
        });
    }

    async updateDepartment(id: number, data: UpdateDepartmentDto, scope?: DataScope) {
        data.organizationId = scope?.organizationId || data?.organizationId;

        return this.departmentRepository.update(id, data);
    }

    async deleteDepartment(id: number, scope?: DataScope) {
        return this.departmentRepository.softDelete(id, scope);
    }
}
