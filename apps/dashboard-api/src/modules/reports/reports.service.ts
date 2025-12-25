import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import {
    AttendanceDateData,
    AttendanceMainReportData,
    AttendanceReportByEmployeeDto,
    AttendanceReportData,
    AttendanceReportDto,
    AttendanceStats,
} from './dto/reports.dto';
import { DataScope, UserContext } from '@app/shared/auth';
import { Attendance } from '@prisma/client';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async generateAttendanceReport(
        dto: AttendanceReportDto,
        user: UserContext,
        scope: DataScope
    ): Promise<AttendanceReportData> {
        const { departmentId, startDate, endDate, organizationId } = dto;

        const depIds = (scope?.departmentIds ?? [departmentId]).filter(Boolean);
        const orgId = scope?.organizationId ?? organizationId;

        if (!orgId) throw new BadRequestException('Please enter organizationId');

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const employees = await this.prisma.employee.findMany({
            where: {
                ...(depIds.length > 0 ? { departmentId: { in: depIds } } : {}),
                organizationId: orgId,
                deletedAt: null,
            },
            include: { department: true, job: true, plan: true },
        });

        const dateData: AttendanceDateData[] = [];
        const tempCursor = new Date(start);
        while (tempCursor <= end) {
            const dateStr = tempCursor.toLocaleDateString('en-CA', {
                timeZone: 'Asia/Tashkent',
                month: '2-digit',
                day: '2-digit',
            });

            const weekday = tempCursor.toLocaleDateString('en-EN', {
                weekday: 'short',
                timeZone: 'Asia/Tashkent',
            });

            dateData.push({
                date: dateStr,
                weekday,
            });

            tempCursor.setDate(tempCursor.getDate() + 1);
        }

        const results: AttendanceMainReportData[] = [];

        for (const emp of employees) {
            const attendances = await this.prisma.attendance.findMany({
                where: { employeeId: emp.id, createdAt: { gte: start, lte: end } },
                orderBy: { createdAt: 'asc' },
            });

            const daysStatistics: (typeof results)[number]['daysStatistics'] = [];

            let totalWorked = 0;
            let totalLate = 0;
            let totalEarly = 0;
            let onTime = 0;
            let overtime = 0;
            let overtimePlan = 0;
            let totalDays = 0;
            let reasonableAbsent = 0;
            let unreasonableAbsent = 0;
            let totalPlanned = 0;

            const attendanceMap = new Map<string, Attendance>();

            for (const att of attendances) {
                const key = att.createdAt.toLocaleDateString('en-CA', {
                    timeZone: 'Asia/Tashkent',
                    month: '2-digit',
                    day: '2-digit',
                });
                attendanceMap.set(key, att);
            }

            for (const d of dateData) {
                const att = attendanceMap.get(d.date);

                // 1️⃣ ATTENDANCE YO‘Q → WEEKEND
                if (!att) {
                    daysStatistics.push({
                        status: 'WEEKEND',
                        totalMinutes: 0,
                    });
                    continue;
                }

                totalDays++;

                // 2️⃣ ISHLAGAN MINUTLAR
                let worked = 0;
                if (att.startTime && att.endTime) {
                    worked = Math.floor((att.endTime.getTime() - att.startTime.getTime()) / 60000);
                } else if (att.startTime) {
                    worked = Math.floor((Date.now() - att.startTime.getTime()) / 60000);
                }

                const planned = att.plannedMinutes ?? 0;

                totalWorked += worked;
                totalLate += att.lateArrivalTime || 0;
                totalEarly += att.earlyGoneTime || 0;
                totalPlanned += planned;

                if (att.isWorkingDay) {
                    const absentMinutes = Math.max(planned - worked, 0);
                    if (att.reasonId || att.reason) reasonableAbsent += absentMinutes;
                    else unreasonableAbsent += absentMinutes;

                    onTime += Math.min(worked, planned);
                    if (worked > planned) overtime += worked - planned;
                } else {
                    overtimePlan += worked;
                }

                daysStatistics.push({
                    status: att.isWorkingDay ? att.arrivalStatus : 'ON_TIME',
                    startTime: att.startTime?.toISOString().slice(11, 16),
                    endTime: att.endTime?.toISOString().slice(11, 16),
                    totalMinutes: worked,
                });
            }

            const week = this.getWeekdayRange(emp.plan.weekdays);
            results.push({
                fio: emp.name,
                position: emp.job?.eng,
                department: emp.department.fullName,
                workSchedule: emp.plan
                    ? `${week} (${emp.plan.startTime} - ${emp.plan.endTime})`
                    : '',
                daysStatistics,

                totalPlannedMinutes: totalPlanned,
                totalLateMinutes: totalLate,
                totalEarlyMinutes: totalEarly,
                totalWorkedMinutes: totalWorked,

                onTimeMinutes: onTime,
                overtimeMinutes: overtime,
                overtimePlanMinutes: overtimePlan,

                reasonableAbsentMinutes: reasonableAbsent,
                unreasonableAbsentMinutes: unreasonableAbsent,

                totalMinutes: onTime + overtime + overtimePlan,
                totalDays,
            });
        }

        return { dateData, reportData: results };
    }

    private getWeekdayRange(raw: string): string {
        if (!raw) return '';

        const array = raw.split(',').map(s => s.trim());

        return `${array[0].slice(0, 3)}–${array[array.length - 1].slice(0, 3)}`;
    }

    private toMinutes(time: string): number {
        const [h, m] = time?.split(':').map(Number);
        return h * 60 + m;
    }

    private diffMinutes(d1: Date, d2: Date): number {
        if (!d1 || !d2) return 0;
        return Math.floor((d2?.getTime() - d1?.getTime()) / 60000);
    }

    async getAttendanceStats(
        dto: AttendanceReportByEmployeeDto,
        user: UserContext
    ): Promise<AttendanceStats> {
        const { startDate, endDate, employeeId } = dto;

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            include: { plan: true },
        });

        if (!employee) throw new BadRequestException('Employee not found');

        const attendances = await this.prisma.attendance.findMany({
            where: {
                employeeId,
                startTime: { gte: start, lte: end },
            },
        });

        let totalArrivalMinutes = 0;
        let totalLeaveMinutes = 0;
        let totalWorkedMinutes = 0;
        let lateCount = 0;
        let earlyCount = 0;

        let validArrivalCount = 0;
        let validLeaveEntries = 0;

        attendances.forEach(att => {
            if (!att.startTime) return;

            if (!att.isWorkingDay) return;

            const arrival = new Date(att.startTime);
            totalArrivalMinutes += arrival.getHours() * 60 + arrival.getMinutes();
            validArrivalCount++;

            if (att.endTime) {
                const leave = new Date(att.endTime);
                totalLeaveMinutes += leave.getHours() * 60 + leave.getMinutes();
                validLeaveEntries++;

                totalWorkedMinutes += this.diffMinutes(att.startTime, att.endTime);
            }

            if (att.lateArrivalTime && att.lateArrivalTime > 0) lateCount++;
            if (att.earlyGoneTime && att.earlyGoneTime > 0) earlyCount++;
        });

        if (validArrivalCount === 0) {
            return {
                averageArrivalTime: 0,
                avgArrivalEarlyMinutes: 0,
                avgArrivalLateMinutes: 0,

                averageLeaveTime: 0,
                avgLeaveEarlyMinutes: 0,
                avgLeaveOvertimeMinutes: 0,

                totalTrackedHours: 0,
                lateArrivalsCount: 0,
                earlyLeavesCount: 0,
            };
        }

        const avgArrivalMin = Math.round(totalArrivalMinutes / validArrivalCount);
        const avgLeaveMin =
            validLeaveEntries > 0 ? Math.round(totalLeaveMinutes / validLeaveEntries) : 0;

        const minutes = this.addExtraTime(
            employee.plan?.startTime,
            employee.plan?.extraTime || '00:00'
        );
        const planStartMin = this.toMinutes(minutes || '09:00');

        const planEndMin = this.toMinutes(employee.plan?.endTime || '18:00');

        const arrivalDiff = planStartMin - avgArrivalMin;

        const avgArrivalEarlyMinutes = arrivalDiff > 0 ? arrivalDiff : 0;
        const avgArrivalLateMinutes = arrivalDiff < 0 ? Math.abs(arrivalDiff) : 0;

        let avgLeaveEarlyMinutes = 0;
        let avgLeaveOvertimeMinutes = 0;

        if (validLeaveEntries > 0) {
            const leaveDiff = avgLeaveMin - planEndMin;

            if (leaveDiff > 0) {
                avgLeaveOvertimeMinutes = leaveDiff;
            } else {
                avgLeaveEarlyMinutes = Math.abs(leaveDiff);
            }
        }

        return {
            averageArrivalTime: avgArrivalMin,
            avgArrivalEarlyMinutes,
            avgArrivalLateMinutes,

            averageLeaveTime: validLeaveEntries > 0 ? avgLeaveMin : 0,
            avgLeaveEarlyMinutes,
            avgLeaveOvertimeMinutes,

            totalTrackedHours: Number((totalWorkedMinutes / 60).toFixed(1)),
            lateArrivalsCount: lateCount,
            earlyLeavesCount: earlyCount,
        };
    }

    private addExtraTime(startTime: string, extraTime: string): string {
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = extraTime.split(':').map(Number);

        let minutes = sh * 60 + sm + eh * 60 + em;

        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;

        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
}
