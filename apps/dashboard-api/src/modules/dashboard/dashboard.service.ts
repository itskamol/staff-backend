import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';

import {
    AttendanceChartDataDto,
    AttendanceChartStatsDto,
    ChartStatsQueryDto,
    DashboardStats,
} from './dto/dashboard.dto';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async generateAttendanceReport(user: UserContext, scope: DataScope): Promise<DashboardStats> {
        const orgId = scope?.organizationId;
        const depId = scope?.departmentIds ?? [];

        const now = new Date();

        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        const start = new Date(new Date(now).setMonth(now.getMonth() - 1));
        start.setHours(0, 0, 0, 0);

        const baseWhere: any = {
            deletedAt: null,
            ...(orgId ? { organizationId: orgId } : {}),
            ...(depId.length > 0 ? { departmentId: { in: depId } } : {}),
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
                    ...(orgId ? { organizationId: orgId } : {}),
                    deletedAt: null,
                },
            }),

            this.prisma.department.count({
                where: {
                    ...(orgId ? { organizationId: orgId } : {}),
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
                    ...(orgId ? { id: orgId } : {}),
                    deletedAt: null,
                },
            }),

            this.prisma.organization.count({
                where: {
                    ...(orgId ? { id: orgId } : {}),
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

    async generateChartStats(
        query: ChartStatsQueryDto,
        user: UserContext,
        scope: DataScope
    ): Promise<AttendanceChartStatsDto> {
        const { startDate = new Date(), endDate = new Date() } = query;
        const { orgId, depIds } = {
            orgId: scope?.organizationId,
            depIds: scope?.departmentIds ?? [],
        };

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const [employees, attendances] = await Promise.all([
            this.prisma.employee.findMany({
                where: {
                    ...(orgId ? { organizationId: orgId } : {}),
                    ...(depIds.length && { departmentId: { in: depIds } }),
                    deletedAt: null,
                },
                select: { id: true },
            }),

            this.prisma.attendance.findMany({
                where: {
                    ...(orgId ? { organizationId: orgId } : {}),
                    createdAt: { gte: start, lte: end },
                    employee: {
                        ...(depIds.length && { departmentId: { in: depIds } }),
                        deletedAt: null,
                    },
                },
                select: {
                    startTime: true,
                    arrivalStatus: true,
                    lateArrivalTime: true,
                    createdAt: true,
                },
            }),
        ]);

        const dailyStatsMap = new Map<string, { onTime: number; late: number; absent: number }>();

        for (const att of attendances) {
            const dateKey = this.getTashkentDate(att.createdAt);

            if (!dailyStatsMap.has(dateKey)) {
                dailyStatsMap.set(dateKey, { onTime: 0, late: 0, absent: 0 });
            }
            const entry = dailyStatsMap.get(dateKey);

            if (att.arrivalStatus === 'ABSENT') {
                entry.absent++;
            } else if (att.arrivalStatus === 'LATE' || (att.lateArrivalTime || 0) > 0) {
                entry.late++;
            } else {
                entry.onTime++;
            }
        }

        const dailyData: AttendanceChartDataDto[] = [];
        const cursor = new Date(start);

        while (cursor <= end) {
            const dateKey = this.getTashkentDate(cursor);

            const stats = dailyStatsMap.get(dateKey) || { onTime: 0, late: 0, absent: 0 };

            dailyData.push({
                date: this.formatDisplayDate(cursor).slice(0, 5).replace('.', '/'),
                onTime: stats.onTime,
                late: stats.late,
                absent: stats.absent,
            });

            cursor.setDate(cursor.getDate() + 1);
        }

        return {
            employeeCount: employees.length,
            data: dailyData,
        };
    }

    private getTashkentDate(date: Date): string {
        return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
    }

    private formatDisplayDate(date: Date): string {
        const d = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(
            2,
            '0'
        )}.${d.getFullYear()}`;
    }
}
