import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Prisma, Role, VisitorType } from '@prisma/client';
import { GetEmployeeSyncDto } from './get-employee-sync.dto';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class EmployeeSyncService {
    private prisma = new PrismaClient();

    async findAll(query: GetEmployeeSyncDto, scope: DataScope, user: UserContext) {
        let organizationId = scope?.organizationId;
        if (!organizationId && user.role != Role.ADMIN) {
            throw new NotFoundException('User organizationId not found!');
        }

        const {
            page = 1,
            limit = 10,
            status,
            gateId,
            employeeId,
            credentialId,
            deviceId,
            userType,
            sort = 'createdAt',
            order = 'desc',
        } = query;

        const skip = (page - 1) * limit;

        const where: Prisma.EmployeeSyncWhereInput = {
            ...(status && { status }),
            ...(gateId && { gateId }),
            ...(organizationId && { organizationId }),
            ...(deviceId && { deviceId }),
            ...(employeeId && { employeeId }),
            ...(credentialId && { credentialId }),
        };

        where.deletedAt = null;

        if (userType === VisitorType.EMPLOYEE) {
            where.visitorId = null;
        }

        if (userType === VisitorType.VISITOR) {
            where.employeeId = null;
        }

        const orderBy: Prisma.EmployeeSyncOrderByWithRelationInput = {
            [sort]: order,
        };

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
                    credential: { select: { id: true, type: true } },
                    device: { select: { name: true, type: true } },
                    visitor: { select: { firstName: true, lastName: true } },
                    onetimeCode: { select: { codeType: true, code: true, isActive: true } },
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
