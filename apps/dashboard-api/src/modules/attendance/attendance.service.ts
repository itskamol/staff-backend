import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRepository } from './attendance.repository';
import { CreateAttendanceDto, AttendanceQueryDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { DataScope } from '@app/shared/auth';
import { Prisma } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LoggerService } from '../../core/logger';

@Injectable()
export class AttendanceService {
    constructor(
        private readonly repo: AttendanceRepository,
        @InjectQueue(JOB.ATTENDANCE.NAME) private readonly attendanceQueue: Queue,
        private readonly logger: LoggerService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyAttendance() {
        this.logger.log('Cron triggered: Adding attendance job to queue...', 'AttendanceService');

        await this.attendanceQueue.add(
            JOB.ATTENDANCE.CREATE_DEFAULT,
            {},
            {
                removeOnComplete: true,
            }
        );
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleAbsentCheck() {
        await this.attendanceQueue.add(JOB.ATTENDANCE.MARK_ABSENT, {}, { removeOnComplete: true });
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async handleAutoClose() {
        await this.attendanceQueue.add(JOB.ATTENDANCE.MARK_GONE, {});
    }

    async create(dto: CreateAttendanceDto) {
        try {
            const { employeeId, organizationId, ...dtoData } = dto;
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const where: Prisma.AttendanceWhereInput = {};

            where.employeeId = dto.employeeId;
            where.createdAt = { gte: todayStart, lte: todayEnd };

            const existing = await this.repo.findMany(where);

            if (existing.length > 0) {
                return existing;
            }

            const data: Prisma.AttendanceCreateInput = {
                ...dtoData,
                employee: { connect: { id: employeeId } },
                organization: { connect: { id: organizationId } },
            };

            return this.repo.create(data);
        } catch (error) {
            throw new BadRequestException({ message: error.message });
        }
    }

    async findAll(query: AttendanceQueryDto, scope: DataScope) {
        const where: Prisma.AttendanceWhereInput = {};
        const { startDate, endDate, employeeId, organizationId, order, sort } = query;

        if (employeeId !== undefined) where.employeeId = employeeId;
        if (organizationId !== undefined) where.organizationId = organizationId;
        if (query.arrivalStatus) where.arrivalStatus = query.arrivalStatus;

        if (query.date) {
            const date = new Date(query.date);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            where.createdAt = {
                gte: startOfDay,
                lte: endOfDay,
            };
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.createdAt = {
                gte: start,
                lte: end,
            };
        }

        if (query.search) {
            where.employee = {
                name: {
                    contains: query.search,
                    mode: 'insensitive',
                },
            };
        }

        const page = query.page ?? 1;
        const limit = query.limit ?? 10;

        const data = await this.repo.findManyWithPagination(
            where,
            { [sort]: order },
            {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        photo: true,
                        department: {
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
                reasons: {
                    select: {
                        uz: true,
                        eng: true,
                        ru: true,
                    },
                },
            },
            { page, limit },
            scope
        );

        return data;
    }

    async findById(id: number, scope: DataScope) {
        const record = await this.repo.findById(
            id,
            {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        photo: true,
                        department: {
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
                reasons: {
                    select: {
                        uz: true,
                        eng: true,
                        ru: true,
                    },
                },
            },
            scope
        );
        if (!record) throw new NotFoundException('Attendance record not found');
        return record;
    }

    async update(id: number, dto: UpdateAttendanceDto, scope?: DataScope) {
        await this.findById(id, scope);
        return this.repo.update(id, dto, {}, scope);
    }

    async findManyForJob(where: Prisma.AttendanceWhereInput, select?: Prisma.AttendanceSelect) {
        return this.repo.findMany(
            where,
            undefined,
            { employee: { include: { plan: { select: { endTime: true } } } } },
            undefined,
            select,
            undefined
        );
    }

    async updateManyForJob(
        where: Prisma.AttendanceWhereInput,
        data: Prisma.AttendanceUpdateManyMutationInput
    ) {
        return this.repo.updateMany(where, data, undefined);
    }
}
