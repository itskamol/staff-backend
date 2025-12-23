import { ConflictException, Injectable } from '@nestjs/common';
import { DepartmentRepository } from './department.repository';
import { Department, Prisma } from '@prisma/client';
import { DataScope } from '@app/shared/auth';
import { CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from './dto';
import { InjectQueue } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';
import { Queue } from 'bullmq';

@Injectable()
export class DepartmentService {
    constructor(
        private readonly departmentRepository: DepartmentRepository,
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue
    ) {}

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
            isSubDepartment,
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

        if (isSubDepartment === true) {
            filters.parentId = { not: null };
        }

        if (isSubDepartment === false) {
            filters.parentId = null;
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
                _count: {
                    select: {
                        employees: { where: { deletedAt: null } },
                        childrens: { where: { deletedAt: null } },
                    },
                },
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
                employees: { where: { deletedAt: null } },
                childrens: { where: { deletedAt: null } },
                _count: {
                    select: {
                        employees: { where: { deletedAt: null } },
                        childrens: { where: { deletedAt: null } },
                    },
                },
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
                parent: { where: { deletedAt: null } },
                childrens: { where: { deletedAt: null } },
                employees: { where: { deletedAt: null } },
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
        const data = await this.getDepartmentById(id, scope);

        const employeeIds = data.employees.map(e => e.id);

        await this.deviceQueue.add(JOB.DEVICE.REMOVE_EMPLOYEES, {
            employeeIds,
        });
        return this.departmentRepository.softDelete(id, scope);
    }
}
