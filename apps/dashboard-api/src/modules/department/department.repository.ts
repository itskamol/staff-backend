import { Injectable } from '@nestjs/common';
import { Department, Prisma } from '@prisma/client';
import { BaseRepository } from '../../shared/repositories/base.repository';
import { PrismaService } from '@app/shared/database';

@Injectable()
export class DepartmentRepository extends BaseRepository<
    Department,
    Prisma.DepartmentCreateInput,
    Prisma.DepartmentUpdateInput,
    Prisma.DepartmentWhereInput,
    Prisma.DepartmentWhereUniqueInput,
    Prisma.DepartmentOrderByWithRelationInput,
    Prisma.DepartmentInclude
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Department;

    protected getDelegate() {
        return this.prisma.department;
    }
}
