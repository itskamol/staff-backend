import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { AttendanceReportData, AttendanceReportDto } from './dto/reports.dto';
import { UserContext } from '../../shared/interfaces';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async generateAttendanceReport(
        dto: AttendanceReportDto,
        user: UserContext
    ): Promise<AttendanceReportData[]> {
        const { departmentId, startDate, endDate, organizationId } = dto;

        if (!organizationId && !user.organizationId) {
            throw new BadRequestException('Please enter organizationId');
        }

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        // ----------------------------------------
        // EMPLOYEE FILTER
        // ----------------------------------------
        const employees = await this.prisma.employee.findMany({
            where: {
                ...(departmentId ? { departmentId } : {}),
                ...(organizationId ? { organizationId } : {}),
                deletedAt: null,
            },
            include: {
                department: true,
                job: true,
                plan: true,
            },
        });

        const results: AttendanceReportData[] = [];

        // ----------------------------------------
        // EMPLOYEE LOOP
        // ----------------------------------------
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

                const weekday = cursor.getDay() === 0 ? 7 : cursor.getDay();
                const isWorkingDay = planWeekdays.split(',').map(Number).includes(weekday);

                const att = attendances.find(
                    a => a.startTime && a.startTime.toISOString().slice(0, 10) === dateStr
                );

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
                    // ➤ Fakten ishlagan kunlar
                    totalDays++;

                    const startT = att.startTime;
                    const endT = att.endTime;
                    const worked = this.diffMinutes(startT, endT);

                    totalWorked += worked;
                    totalLate += att.lateArrivalTime || 0;
                    totalEarly += att.earlyGoneTime || 0;

                    // Rejaga nisbatan ortiqcha vaqt
                    if (worked > planDailyMinutes) {
                        overtime += worked - planDailyMinutes;
                    }

                    // ➤ Dam olish kuni → overtimePlan
                    if (!isWorkingDay) {
                        overtimePlan += worked;
                    } else {
                        onTimeMinutes += Math.min(worked, planDailyMinutes);
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

            // ----------------------------------------
            // YAKUN — REPORTGA PUSH QILISH
            // ----------------------------------------
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

        return results;
    }

    // private getWeekdayRange(raw: string): string {
    //     if (!raw) return '';

    //     const array = raw.split(',').map(s => s.trim());

    //     return `${array[0].slice(0, 3)}–${array[array.length - 1].slice(0, 3)}`;
    // }

    private getWeekdayRange(raw: string): string {
        if (!raw) return '';
        const arr = raw
            .split(',')
            .map(Number)
            .sort((a, b) => a - b);
        return `${arr[0].toString().slice(0, 3)}–${arr[arr.length - 1].toString().slice(0, 3)}`;
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
        const plan = raw.split(',').map(Number);
        let count = 0;
        const cur = new Date(start);

        const endDate = new Date(end);

        while (cur <= endDate) {
            const day = cur?.getDay() === 0 ? 7 : cur?.getDay();
            if (plan.includes(day)) count++;
            cur?.setDate(cur?.getDate() + 1);
        }
        return count;
    }
}
