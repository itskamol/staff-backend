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
import { PrismaService } from '@app/shared/database';
import { TimezoneUtil, getUtcDayRange, normalizeToUtc } from '@app/shared/utils';

@Injectable()
export class AttendanceService {
    constructor(
        private readonly repo: AttendanceRepository,
        @InjectQueue(JOB.ATTENDANCE.NAME) private readonly attendanceQueue: Queue,
        private readonly logger: LoggerService,
        private readonly prisma: PrismaService
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleDailyAttendance() {
        this.logger.log('Cron triggered: Adding attendance job to queue...');

        await this.attendanceQueue.add(
            JOB.ATTENDANCE.CREATE_DEFAULT,
            {},
            {
                removeOnComplete: true,
            }
        );
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async handleAbsentCheck() {
        await this.attendanceQueue.add(JOB.ATTENDANCE.MARK_ABSENT, {}, { removeOnComplete: true });
    }

    async create(dto: CreateAttendanceDto) {
        try {
            const { employeeId, organizationId } = dto;

            const timeZone = await this.resolveEmployeeTimeZone(
                employeeId,
                organizationId,
                dto.timeZone
            );

            const { startUtc, endUtc } = getUtcDayRange(dto.startTime, timeZone);

            const where: Prisma.AttendanceWhereInput = {};

            where.employeeId = dto.employeeId;
            where.startTime = { gte: startUtc, lte: endUtc };

            const existing = await this.repo.findMany(where);

            if (existing.length > 0) {
                return existing;
            }

            const data: Prisma.AttendanceCreateInput = {
                arrivalStatus: dto.arrivalStatus,
                goneStatus: dto.goneStatus,
                reason: dto.reason,
                startTime: normalizeToUtc(dto.startTime, timeZone),
                endTime: dto.endTime ? normalizeToUtc(dto.endTime, timeZone) : undefined,
                timeZone,
                employee: { connect: { id: employeeId } },
                ...(organizationId && {
                    organization: { connect: { id: organizationId } },
                }),
            };

            return this.repo.create(data);
        } catch (error) {
            throw new BadRequestException({ message: error.message });
        }
    }

    async findAll(query: AttendanceQueryDto, scope: DataScope) {
        const where: Prisma.AttendanceWhereInput = {};

        if (query.employeeId !== undefined) where.employeeId = query.employeeId;
        if (query.organizationId !== undefined) where.organizationId = query.organizationId;
        if (query.arrivalStatus) where.arrivalStatus = query.arrivalStatus;

        if (query.date) {
            const timeZone = await this.resolveOrganizationTimeZone(
                query.timeZone,
                query.organizationId ?? scope?.organizationId
            );
            const { startUtc, endUtc } = getUtcDayRange(query.date, timeZone);

            where.startTime = {
                gte: startUtc,
                lte: endUtc,
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
            { startTime: 'desc' },
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
            },
            scope
        );
        if (!record) throw new NotFoundException('Attendance record not found');
        return record;
    }

    async update(id: number, dto: UpdateAttendanceDto, scope: DataScope) {
        const existing = await this.findById(id, scope);

        const resolvedZone = await this.resolveOrganizationTimeZone(
            dto.timeZone ?? existing?.timeZone,
            existing?.organizationId
        );

        const data: Prisma.AttendanceUpdateInput = {
            ...(dto.arrivalStatus && { arrivalStatus: dto.arrivalStatus }),
            ...(dto.goneStatus && { goneStatus: dto.goneStatus }),
            ...(dto.reason !== undefined && { reason: dto.reason }),
            ...(dto.startTime && { startTime: normalizeToUtc(dto.startTime, resolvedZone) }),
            ...(dto.endTime && { endTime: normalizeToUtc(dto.endTime, resolvedZone) }),
            ...(dto.timeZone && { timeZone: dto.timeZone }),
        };

        return this.repo.update(id, data, {}, scope);
    }

    async delete(id: number, scope: DataScope) {
        await this.findById(id, scope);
        return this.repo.delete(id, scope);
    }

    async findManyForJob(where: Prisma.AttendanceWhereInput, select?: Prisma.AttendanceSelect) {
        return this.repo.findMany(where, undefined, undefined, undefined, select, undefined);
    }

    async updateManyForJob(
        where: Prisma.AttendanceWhereInput,
        data: Prisma.AttendanceUpdateManyMutationInput
    ) {
        return this.repo.updateMany(where, data, undefined);
    }

    private async resolveEmployeeTimeZone(
        employeeId: number,
        organizationId?: number,
        explicit?: string
    ): Promise<string> {
        if (explicit) {
            return explicit;
        }

        if (organizationId) {
            const organizationZone = await this.lookupOrganizationTimeZone(organizationId);
            if (organizationZone) {
                return organizationZone;
            }
        }

        const employee = await this.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                organization: {
                    select: { defaultTimeZone: true },
                },
            },
        });

        if (employee?.organization?.defaultTimeZone) {
            return employee.organization.defaultTimeZone;
        }

        return TimezoneUtil.DEFAULT_TIME_ZONE;
    }

    private async resolveOrganizationTimeZone(
        explicit?: string,
        organizationId?: number
    ): Promise<string> {
        if (explicit) {
            return explicit;
        }

        if (organizationId) {
            const organizationZone = await this.lookupOrganizationTimeZone(organizationId);
            if (organizationZone) {
                return organizationZone;
            }
        }

        return TimezoneUtil.DEFAULT_TIME_ZONE;
    }

    private async lookupOrganizationTimeZone(organizationId: number): Promise<string | null> {
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            select: { defaultTimeZone: true },
        });

        return organization?.defaultTimeZone ?? null;
    }
}
