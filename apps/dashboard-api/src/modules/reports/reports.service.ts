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
            dateData.push({
                date: tempCursor.toISOString().slice(5, 10),
                weekday: tempCursor.toLocaleDateString('en-EN', { weekday: 'short' }),
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

            for (const att of attendances) {
                totalDays++;

                const todayStr = new Date().toISOString().slice(0, 10);
                const attDateStr = att.startTime?.toISOString().slice(0, 10) || todayStr;

                // Ishlagan minutlarni hisoblash
                let worked = 0;
                if (att.startTime && att.endTime) {
                    worked = Math.floor((att.endTime.getTime() - att.startTime.getTime()) / 60000);
                } else if (att.startTime && attDateStr === todayStr) {
                    worked = Math.floor((new Date().getTime() - att.startTime.getTime()) / 60000);
                }

                const planned = att.plannedMinutes ?? 0;
                totalPlanned += planned;

                totalWorked += worked;
                totalLate += att.lateArrivalTime || 0;
                totalEarly += att.earlyGoneTime || 0;

                if (att.isWorkingDay) {
                    const absentMinutes = Math.max(planned - worked, 0);
                    if (att.reasonId || att.reason) reasonableAbsent += absentMinutes;
                    else unreasonableAbsent += absentMinutes;

                    onTime += Math.min(worked, planned);
                    if (worked > planned) overtime += worked - planned;
                } else {
                    // Dam olish kuni ishlagan minutlar → overtimePlan
                    overtimePlan += worked;
                }

                daysStatistics.push({
                    status: att.arrivalStatus || (att.isWorkingDay ? 'ABSENT' : 'WEEKEND'),
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

        const workingDays = this.getWorkingDayNumbers(employee.plan?.weekdays || '');

        let totalArrivalMinutes = 0;
        let totalLeaveMinutes = 0;
        let totalWorkedMinutes = 0;
        let lateCount = 0;
        let earlyCount = 0;

        let validArrivalCount = 0;
        let validLeaveEntries = 0;

        attendances.forEach(att => {
            if (!att.startTime) return;

            let dayOfWeek = att.startTime.getDay();
            if (dayOfWeek === 0) dayOfWeek = 7;
            if (!workingDays.includes(dayOfWeek)) return;

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
                averageArrivalTime: '--:--',
                avgArrivalEarlyMinutes: 0,
                avgArrivalLateMinutes: 0,

                averageLeaveTime: '--:--',
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

        const planStartMin = this.toMinutes(employee.plan?.startTime || '09:00');
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
            averageArrivalTime: this.minutesToAmPm(avgArrivalMin),
            avgArrivalEarlyMinutes,
            avgArrivalLateMinutes,

            averageLeaveTime: validLeaveEntries > 0 ? this.minutesToAmPm(avgLeaveMin) : '--:--',
            avgLeaveEarlyMinutes,
            avgLeaveOvertimeMinutes,

            totalTrackedHours: Number((totalWorkedMinutes / 60).toFixed(1)),
            lateArrivalsCount: lateCount,
            earlyLeavesCount: earlyCount,
        };
    }

    private minutesToAmPm(totalMinutes: number): string {
        if (totalMinutes < 0) totalMinutes = 0;

        let hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12;

        const hStr = hours.toString().padStart(2, '0');
        const mStr = minutes.toString().padStart(2, '0');

        return `${hStr}:${mStr} ${ampm}`;
    }

    private getWorkingDayNumbers(weekdaysStr: string): number[] {
        if (!weekdaysStr) return [];

        const map: Record<string, number> = {
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
            Sunday: 7,
        };

        return weekdaysStr
            .split(',')
            .map(day => day.trim())
            .map(day => map[day])
            .filter(num => num);
    }
}
