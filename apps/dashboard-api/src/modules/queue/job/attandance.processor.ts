import { Processor, WorkerHost } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Job } from 'bullmq';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { AttendanceService } from 'apps/dashboard-api/src/modules/attendance/attendance.service';
import { EmployeePlanService } from '../../employeePlan/employee-plan.service';
import { ActionStatus, Prisma } from '@prisma/client';

@Processor(JOB.ATTENDANCE.NAME, { concurrency: 5 })
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
                    deletedAt: null,
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
            console.log(err);
            this.logger.error(`Error marking absent employees:`, err, 'MarkedAttendanceJob');
        }
    }

    async markGoneEmployees(job: Job) {
        this.logger.log(`Auto-closing attendance records...`, 'AttendanceJob');

        try {
            const startOfPeriod = new Date();
            startOfPeriod.setDate(startOfPeriod.getDate() - 1);
            startOfPeriod.setHours(0, 0, 0, 0);

            const endOfPeriod = new Date();
            endOfPeriod.setDate(endOfPeriod.getDate() - 1);
            endOfPeriod.setHours(23, 59, 59, 999);

            const whereCondition: Prisma.AttendanceWhereInput = {
                arrivalStatus: { in: [ActionStatus.ON_TIME, ActionStatus.LATE] },
                goneStatus: null,
                createdAt: {
                    gte: startOfPeriod,
                    lte: endOfPeriod,
                },
                employee: {
                    plan: { isActive: true, deletedAt: null },
                },
                deletedAt: null,
            };

            const openRecords = await this.attendanceService.findManyForJob(whereCondition, {
                id: true,
                createdAt: true,
                employee: {
                    select: {
                        plan: { select: { endTime: true } },
                    },
                },
            });

            if (!openRecords || openRecords.length === 0) {
                this.logger.log('No open attendance records found to close.', 'AttendanceJob');
                return;
            }

            this.logger.log(`Found ${openRecords.length} records to auto-close.`, 'AttendanceJob');

            let updatedCount = 0;

            for (const record of openRecords) {
                try {
                    const planEndTime = (record as any).employee?.plan?.endTime;

                    if (!planEndTime) continue;

                    const recordDate = new Date(record.createdAt);
                    const [hours, minutes] = planEndTime.split(':').map(Number);

                    const autoEndTime = new Date(recordDate);
                    autoEndTime.setHours(hours, minutes, 0, 0);

                    await this.attendanceService.update(record.id, {
                        endTime: autoEndTime,
                        goneStatus: ActionStatus.ON_TIME,
                    });

                    updatedCount++;
                } catch (err) {
                    this.logger.warn(
                        `Failed to auto-close attendance ${record.id}: ${err.message}`,
                        'AttendanceJob'
                    );
                }
            }

            this.logger.log(`Successfully auto-closed ${updatedCount} records.`, 'AttendanceJob');
        } catch (err) {
            this.logger.error(`Error in markGoneEmployees:`, err, 'AttendanceJob');
            throw err;
        }
    }

    async process(job: Job<any, any, string>) {
        switch (job.name) {
            case JOB.ATTENDANCE.CREATE_DEFAULT:
                return this.createDefaultAttendance(job);

            case JOB.ATTENDANCE.MARK_ABSENT:
                return this.markAbsentEmployees(job);

            case JOB.ATTENDANCE.MARK_GONE:
                return this.markGoneEmployees(job);

            default:
                break;
        }
    }
}
