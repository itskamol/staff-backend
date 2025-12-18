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

        const depId = (scope?.departmentIds ?? [departmentId]).filter(Boolean);
        const orgId = scope?.organizationId ?? organizationId;

        if (!orgId) {
            throw new BadRequestException('Please enter organizationId');
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const employees = await this.prisma.employee.findMany({
            where: {
                ...(depId.length > 0 ? { departmentId: { in: depId } } : {}),
                organizationId: orgId,
                id: 16,
                deletedAt: null,
            },
            include: {
                department: true,
                job: true,
                plan: true,
            },
        });

        const results: AttendanceMainReportData[] = [];

        const dateData: AttendanceDateData[] = [];

        const cursor = new Date(startDate);
        while (cursor <= end) {
            dateData.push({
                date: cursor.toISOString().slice(5, 10),
                weekday: cursor.toLocaleDateString('en-EN', { weekday: 'short' }),
            });
            cursor.setDate(cursor.getDate() + 1);
        }

        for (const emp of employees) {
            const plan = emp.plan;
            const planStart = plan?.startTime;
            const planEnd = plan?.endTime;
            const planWeekdays = plan?.weekdays || '';

            const planStartMin = this.toMinutes(planStart);
            const planEndMin = this.toMinutes(planEnd);
            const planDailyMinutes = planEndMin - planStartMin;

            const planRange = this.getWeekdayRange(planWeekdays);

            // Planga ko‘ra qancha kun ishlashi kerak
            const totalPlannedDays = this.countPlannedDays(startDate, endDate, planWeekdays);
            // Rejada ishlashi shart bo‘lgan umumiy soatlar
            const totalHoursPlan = planDailyMinutes * totalPlannedDays;

            // Attendance records
            const attendances = await this.prisma.attendance.findMany({
                where: {
                    employeeId: emp.id,
                    createdAt: { gte: start, lte: end },
                },
                orderBy: { createdAt: 'asc' },
            });
            // Statistika yig‘iladigan joy
            let totalWorked = 0;
            let totalLate = 0;
            let totalEarly = 0;
            let onTimeMinutes = 0;
            let overtime = 0;
            let overtimePlan = 0;
            let totalDays = 0;
            let reasonableAbsent = 0;
            let unreasonableAbsent = 0;

            const daysStatistics = [];

            // Kalendar bo‘yicha yuramiz
            const cursor = new Date(startDate);

            while (cursor <= end) {
                const dateStr = cursor.toISOString().slice(0, 10);
                const weekdayName = cursor.toLocaleDateString('en-EN', { weekday: 'long' });

                const weekdayMap: Record<string, number> = {
                    Monday: 1,
                    Tuesday: 2,
                    Wednesday: 3,
                    Thursday: 4,
                    Friday: 5,
                    Saturday: 6,
                    Sunday: 7,
                };

                const plannedDays = planWeekdays.split(',').map(d => weekdayMap[d.trim()]);

                const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
                const isWorkingDay = plannedDays.includes(weekday);

                const att = attendances.find(a => {
                    if (!a.startTime) return false;

                    const localDate = new Date(a.startTime);
                    localDate.setHours(localDate.getHours() + 5);

                    return localDate.toISOString().slice(0, 10) === dateStr;
                });

                if (!att) {
                    // ➤ Ish kuni – lekin yo‘q → ABSENT
                    if (isWorkingDay) {
                        unreasonableAbsent += planDailyMinutes;
                        daysStatistics.push({
                            weekDay: weekdayName,
                            status: 'ABSENT',
                            totalHours: '0',
                        });
                    } else {
                        // ➤ Dam olish kuni
                        daysStatistics.push({
                            weekDay: weekdayName,
                            status: 'WEEKEND',
                            totalHours: '0',
                        });
                    }
                } else {
                    totalDays++;

                    const startT = att.startTime;
                    const endT = att.endTime;
                    const worked = this.diffMinutes(startT, endT);

                    totalWorked += worked;

                    const late = att.lateArrivalTime || 0;
                    const early = att.earlyGoneTime || 0;

                    totalLate += late;
                    totalEarly += early;

                    if (isWorkingDay) {
                        const absentMinutes = Math.max(planDailyMinutes - worked, 0);

                        if (att.reasonTypeId || att.reason) {
                            reasonableAbsent += absentMinutes;
                        } else {
                            unreasonableAbsent += absentMinutes;
                        }

                        onTimeMinutes += Math.min(worked, planDailyMinutes);

                        if (worked > planDailyMinutes) {
                            overtime += worked - planDailyMinutes;
                        }
                    } else {
                        overtimePlan += worked;
                    }

                    daysStatistics.push({
                        weekDay: weekdayName,
                        status: att.arrivalStatus || 'ON_TIME',
                        startTime: this.formatTime(startT),
                        endTime: this.formatTime(endT),
                        totalHours: this.formatHours(worked),
                    });
                }

                cursor.setDate(cursor.getDate() + 1);
            }

            // Yakuniy natijani qo‘shish
            results.push({
                fio: emp.name,
                position: emp.job?.eng,
                department: emp.department.fullName,

                workSchedule: `${planRange} (${planStart} - ${planEnd})`,
                daysStatistics,

                totalHoursPlan: this.formatHours(totalHoursPlan),
                totalHoursLate: this.formatHours(totalLate),
                totalHoursEarly: this.formatHours(totalEarly),
                totalWorkedHours: this.formatHours(totalWorked),

                ontimeHours: this.formatHours(onTimeMinutes),
                overtimeHours: this.formatHours(overtime),

                overtimePlanHours: this.formatHours(overtimePlan),

                resonableAbsentHours: this.formatHours(reasonableAbsent),
                unresaonableAbsentHours: this.formatHours(unreasonableAbsent),

                total: this.formatHours(onTimeMinutes + overtime + overtimePlan),
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

    private formatHours(min: number): string {
        return `${Math.floor(min / 60)}h ${min % 60}m`;
    }

    private formatTime(d: Date): string {
        return d?.toTimeString().slice(0, 5);
    }

    private countPlannedDays(start: string, end: string, raw: string): number {
        const map: Record<string, number> = {
            Monday: 1,
            Tuesday: 2,
            Wednesday: 3,
            Thursday: 4,
            Friday: 5,
            Saturday: 6,
            Sunday: 7,
        };

        const plan = raw.split(',').map(w => map[w.trim()]);

        let count = 0;

        const cur = new Date(start);
        const endDate = new Date(end);

        while (cur <= endDate) {
            const jsDay = cur.getDay();
            const day = jsDay === 0 ? 7 : jsDay;

            if (plan.includes(day)) count++;

            cur.setDate(cur.getDate() + 1);
        }

        return count;
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
