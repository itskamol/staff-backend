import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { GetEmployeeSyncDto } from './get-employee-sync.dto';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class EmployeeSyncService {
    private prisma = new PrismaClient();

    async findAll(query: GetEmployeeSyncDto, scope: DataScope, user: UserContext) {
        let organizationId = scope?.organizationId;
        if (!organizationId && user.role != 'ADMIN') {
            throw new NotFoundException('User organizationId not found!');
        }

        const {
            page = 1,
            limit = 10,
            status,
            gateId,
            employeeId,
            sort = 'createdAt',
            order = 'desc',
            isDeleted,
        } = query;

        const skip = (page - 1) * limit;

        const where: Prisma.EmployeeSyncWhereInput = {
            ...(status && { status }),
            ...(gateId && { gateId }),
            ...(organizationId && { organizationId }),
            ...(employeeId && { employeeId }),
        };

        const orderBy: Prisma.EmployeeSyncOrderByWithRelationInput = {
            [sort]: order,
        };

        if (!isDeleted) {
            where.deletedAt = null;
        }

        const [data, total] = await Promise.all([
            this.prisma.employeeSync.findMany({
                where,
                orderBy,
                skip,
                take: limit,
                include: {
                    gate: { select: { id: true, name: true } }, // gate relation
                    employee: { select: { id: true, name: true, photo: true } },
                    organization: { select: { id: true, fullName: true } },
                },
            }),
            this.prisma.employeeSync.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
        };
    }
}
