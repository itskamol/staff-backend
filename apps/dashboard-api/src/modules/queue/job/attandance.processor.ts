import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { AttendanceService } from 'apps/dashboard-api/src/modules/attendance/attendance.service';
import { EmployeePlanService } from '../../employeePlan/employee-plan.service';
import { ActionStatus, Prisma } from '@prisma/client';
import { TimezoneUtil, formatInTimeZone, getUtcDayRange } from '@app/shared/utils';

@Processor(JOB.ATTENDANCE.NAME, { concurrency: 1 })
export class AttendanceProcessor extends WorkerHost {
    constructor(
        private readonly attendanceService: AttendanceService,
        private readonly employeePlanService: EmployeePlanService,
        private readonly logger: LoggerService
    ) {
        super();
    }

    async createDefaultAttendance(_job: Job) {
        this.logger.log(`[AttendanceJob] Started creating default attendance...`);
        try {
            const plans = await this.employeePlanService.findActivePlansForJob();
            const now = new Date();

            let processedCount = 0;
            for (const plan of plans) {
                const timeZone = plan.timeZone ?? TimezoneUtil.DEFAULT_TIME_ZONE;
                const weekdayName = formatInTimeZone(now, timeZone, 'EEEE');

                if (!plan.weekdaysList.includes(weekdayName)) {
                    continue;
                }

                if (!plan.employees || plan.employees.length === 0) {
                    continue;
                }

                const planStartTime = this.buildPlanStartDate(now, timeZone, plan.startTime);

                for (const emp of plan.employees) {
                    try {
                        await this.attendanceService.create({
                            employeeId: emp.id,
                            organizationId: plan.organizationId,
                            arrivalStatus: ActionStatus.PENDING,
                            startTime: planStartTime,
                            timeZone,
                        } as any); 
                        
                        processedCount++;
                    } catch (err) {
                        this.logger.warn(`[AttendanceJob] Failed for Employee ${emp.id}: ${err.message}`);
                    }
                }
            }

            this.logger.log(`[AttendanceJob] Finished. Processed ${processedCount} records.`);

        } catch (err) {
            this.logger.error(`[AttendanceJob] Fatal Error:`, err);
            throw err;
        }
    }

    async markAbsentEmployees(_job: Job) {
        try {
            const now = new Date();
            const plans = await this.employeePlanService.findActivePlansForJob();
            let totalMarked = 0;

            for (const plan of plans) {
                if (!plan.employees || plan.employees.length === 0) {
                    continue;
                }

                const timeZone = plan.timeZone ?? TimezoneUtil.DEFAULT_TIME_ZONE;
                const currentTimeString = formatInTimeZone(now, timeZone, 'HH:mm');
                const planStartTime = this.normalizePlanTime(plan.startTime);

                if (planStartTime && planStartTime > currentTimeString) {
                    continue;
                }

                const employeeIds = plan.employees.map(emp => emp.id).filter(Boolean);
                if (!employeeIds.length) {
                    continue;
                }

                const { startUtc, endUtc } = getUtcDayRange(now, timeZone);

                const whereCondition: Prisma.AttendanceWhereInput = {
                    arrivalStatus: ActionStatus.PENDING,
                    timeZone,
                    employeeId: { in: employeeIds },
                    startTime: {
                        gte: startUtc,
                        lte: endUtc,
                    },
                };

                const lateRecords = await this.attendanceService.findManyForJob(
                    whereCondition,
                    { id: true }
                );

                if (!lateRecords || lateRecords.length === 0) {
                    continue;
                }

                const idsToUpdate = lateRecords.map(record => record.id);

                const updateResult = await this.attendanceService.updateManyForJob(
                    { id: { in: idsToUpdate } },
                    { arrivalStatus: ActionStatus.ABSENT }
                );

                totalMarked += updateResult.count ?? 0;
            }

            this.logger.debug(
                `[AttendanceJob] Marked ${totalMarked} employees as ABSENT across active plans.`
            );

        } catch (err) {
            this.logger.error(`[AttendanceJob] Error marking absent employees:`, err);
        }
    }

    async process(job: Job<any, any, string>) {
        switch (job.name) {
            case JOB.ATTENDANCE.CREATE_DEFAULT:
                return this.createDefaultAttendance(job);
            
            case JOB.ATTENDANCE.MARK_ABSENT:
                return this.markAbsentEmployees(job);
                
            default:
                break;
        }
    }

    private buildPlanStartDate(date: Date, zone: string, planStartTime?: string): string {
        const timePart = this.normalizePlanTime(planStartTime);
        const localDate = formatInTimeZone(date, zone, 'yyyy-MM-dd');
        return `${localDate}T${timePart}:00`;
    }

    private normalizePlanTime(planTime?: string): string {
        if (!planTime) {
            return '00:00';
        }

        const [hours = '00', minutes = '00'] = planTime.split(':');
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }
}