import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';

import { DashboardStats } from './dto/dashboard.dto';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async generateAttendanceReport(user: UserContext, scope: DataScope): Promise<DashboardStats> {
        const orgId = scope?.organizationId;
        const depId = scope?.departmentIds ?? [];

        const now = new Date();

        // end → bugun 23:59:59
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        // start → 1 oy oldin 00:00:00
        const start = new Date(new Date(now).setMonth(now.getMonth() - 1));
        start.setHours(0, 0, 0, 0);

        // 🔹 Base where (hamma query uchun umumiy)
        const baseWhere: any = {
            organizationId: orgId,
            ...(depId.length > 0 ? { departmentId: { in: depId } } : {}),
            deletedAt: null,
        };

        const [
            totalEmployees,
            newEmployeesCount,
            totalDepartments,
            newDepartmentsCount,
            totalComputers,
            newComputersCount,
            totalOrganizations,
            newOrganizationsCount,
        ] = await Promise.all([
            this.prisma.employee.count({
                where: baseWhere,
            }),

            this.prisma.employee.count({
                where: {
                    ...baseWhere,
                    createdAt: { gte: start, lte: end },
                },
            }),

            this.prisma.department.count({
                where: {
                    organizationId: orgId,
                    deletedAt: null,
                },
            }),

            this.prisma.department.count({
                where: {
                    organizationId: orgId,
                    createdAt: { gte: start, lte: end },
                    deletedAt: null,
                },
            }),

            this.prisma.computer.count({
                where: {
                    ...baseWhere,
                },
            }),

            this.prisma.computer.count({
                where: {
                    ...baseWhere,
                    createdAt: { gte: start, lte: end },
                },
            }),

            this.prisma.organization.count({
                where: {
                    id: orgId,
                    deletedAt: null,
                },
            }),

            this.prisma.organization.count({
                where: {
                    id: orgId,
                    createdAt: { gte: start, lte: end },
                    deletedAt: null,
                },
            }),
        ]);

        const result: DashboardStats = {
            totalEmployees,
            newEmployeesCount,

            totalComputers,
            newComputersCount,

            totalDepartments,
            newDepartmentsCount,

            totalOrganizations,
            newOrganizationsCount,
        };

        return result;
    }
}
