import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { AttendanceService } from 'apps/dashboard-api/src/modules/attendance/attendance.service';
import { EmployeePlanService } from '../../employeePlan/employee-plan.service';
import { ActionStatus, Prisma } from '@prisma/client';

@Processor(JOB.ATTENDANCE.NAME, { concurrency: 1 })
export class AttendanceProcessor extends WorkerHost {
    constructor(
        private readonly attendanceService: AttendanceService,
        private readonly employeePlanService: EmployeePlanService,
        private readonly logger: LoggerService
    ) {
        super();
    }

    async createDefaultAttendance(job: Job) {
        this.logger.log(`Started creating default attendance...`, 'AttendanceJob');
        try {
            const today = new Date();
            const weekdayName = today.toLocaleDateString('en-US', { weekday: 'long' });

            const plans = await this.employeePlanService.findActivePlansForJob();

            let processedCount = 0;
            for (const plan of plans) {
                if (!plan.weekdaysList.includes(weekdayName)) {
                    continue;
                }

                if (!plan.employees || plan.employees.length === 0) {
                    continue;
                }

                for (const emp of plan.employees) {
                    try {
                        await this.attendanceService.create({
                            employeeId: emp.id,
                            organizationId: emp.organizationId,
                            arrivalStatus: ActionStatus.PENDING,
                        } as any);

                        processedCount++;
                    } catch (err) {
                        this.logger.warn(
                            `[AttendanceJob] Failed for Employee ${emp.id}: ${err.message}`
                        );
                    }
                }
            }

            this.logger.log(`Finished. Processed ${processedCount} records.`, 'AttendanceJob');
        } catch (err) {
            this.logger.error(`Fatal Error:`, err, 'AttendanceJob');
            throw err;
        }
    }

    async markAbsentEmployees(job: Job) {
        try {
            const now = new Date();
            const currentHours = now.getHours().toString().padStart(2, '0');
            const currentMinutes = now.getMinutes().toString().padStart(2, '0');
            const currentTimeString = `${currentHours}:${currentMinutes}`;
            this.logger.log(
                `Marked employees starting... (Current Time: ${currentTimeString})`,
                'MarkedAttandanceJob'
            );
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);

            const whereCondition: Prisma.AttendanceWhereInput = {
                arrivalStatus: ActionStatus.PENDING,
                createdAt: {
                    gte: startOfToday,
                    lte: endOfToday,
                },
                employee: {
                    plan: {
                        isActive: true,
                        startTime: { lte: currentTimeString },
                    },
                },
            };

            const lateRecords = await this.attendanceService.findManyForJob(whereCondition, {
                id: true,
            });

            if (!lateRecords || lateRecords.length === 0) {
                return;
            }

            const idsToUpdate = lateRecords.map((r: any) => r.id);

            const updateResult = await this.attendanceService.updateManyForJob(
                { id: { in: idsToUpdate } },
                { arrivalStatus: ActionStatus.ABSENT }
            );

            this.logger.log(
                `Marked ${updateResult.count} employees as ABSENT (Current Time: ${currentTimeString})`,
                'MarkedAttendanceJob'
            );
        } catch (err) {
            this.logger.error(`Error marking absent employees:`, err, 'MarkedAttendanceJob');
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
}
