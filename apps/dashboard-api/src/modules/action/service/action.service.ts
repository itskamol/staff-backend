import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionRepository } from '../repositories/action.repository';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { PrismaService } from '@app/shared/database';
import { ActionMode, ActionStatus, ActionType, Prisma, VisitorType } from '@prisma/client';
import { AttendanceService } from '../../attendance/attendance.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { DataScope } from '@app/shared/auth';
import { CreateAttendanceDto } from '../../attendance/dto/attendance.dto';

@Injectable()
export class ActionService {
    constructor(
        private readonly repo: ActionRepository,
        private readonly attendanceService: AttendanceService,
        private prisma: PrismaService,
        private readonly logger: LoggerService
    ) {}

    async create(eventData: any, deviceId: number, employeeId: number) {
        try {
            const acEvent =
                eventData.AccessControllerEvent || eventData.EventNotificationAlert || {};

            console.log('acEvent:', acEvent);

            const actionTime = eventData.dateTime || acEvent.dateTime;
            const { originalLicensePlate } = acEvent?.ANPR;
            let actionType = originalLicensePlate
                ? ActionType.CAR
                : acEvent.subEventType == 181
                ? ActionType.PERSONAL_CODE
                : acEvent.subEventType == 75
                ? ActionType.PHOTO
                : ActionType.CARD;

            const device = await this.prisma.device.findFirst({ where: { id: deviceId } });
            if (!device) throw new Error(`Device ${deviceId} not found!`);

            const gate = await this.prisma.gate.findFirst({ where: { id: device.gateId } });
            if (!gate) throw new Error(`Gate ${device.gateId} not found!`);

            const employee = await this.prisma.employee.findFirst({ where: { id: employeeId } });
            if (!employee) throw new Error(`Employee ${employeeId} not found`);

            if (!employee.employeePlanId) {
                throw new Error(`EmployeePlan is not found for Employee`);
            }

            const organizationId = employee.organizationId;

            const plan = await this.prisma.employeePlan.findFirst({
                where: { id: employee.employeePlanId },
            });
            if (!plan) throw new Error(`Employee plan ${employee.employeePlanId} not found`);

            const dto: CreateActionDto = {
                deviceId,
                gateId: gate.id,
                actionTime,
                employeeId,
                visitorId: undefined,
                visitorType:
                    acEvent.userType === 'normal' || device.type === 'CAR'
                        ? VisitorType.EMPLOYEE
                        : VisitorType.VISITOR,
                entryType: device.entryType,
                actionType,
                actionResult: null,
                actionMode:
                    eventData.eventState === 'active' || acEvent.eventState === 'active'
                        ? ActionMode.ONLINE
                        : ActionMode.OFFLINE,
                organizationId,
            };

            const todayStart = new Date(actionTime);
            todayStart.setHours(0, 0, 0, 0);

            const todayEnd = new Date(actionTime);
            todayEnd.setHours(23, 59, 59, 999);

            if (device.entryType === 'BOTH') {
                const lastInfo = await this.getLastActionInfo(
                    employeeId,
                    organizationId,
                    todayStart,
                    todayEnd
                );

                if (!lastInfo.canCreate) {
                    return;
                }

                dto.entryType = lastInfo.nextEntryType as any;
            }

            if (dto.entryType === 'EXIT') {
                const { status: exitStatus, diffMinutes } = await this.getExitStatus(
                    actionTime,
                    plan.endTime
                );

                const existingAttendance = await this.prisma.attendance.findFirst({
                    where: {
                        employeeId,
                        organizationId,
                        startTime: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                    },
                    orderBy: { startTime: 'desc' },
                });

                if (existingAttendance) {
                    await this.prisma.attendance.update({
                        where: { id: existingAttendance.id },
                        data: {
                            endTime: actionTime,
                            goneStatus: exitStatus,
                            earlyGoneTime: diffMinutes,
                        },
                    });
                } else {
                    this.logger.warn(`⚠️ Attendance NOT FOUND (EXIT): employee ${employeeId}`);
                }
            }

            if (dto.entryType === 'ENTER') {
                const { status, diffMinutes } = await this.getEnterStatus(
                    actionTime,
                    plan.startTime,
                    plan.extraTime
                );

                const existingAttendance = await this.prisma.attendance.findFirst({
                    where: {
                        employeeId,
                        organizationId,
                        createdAt: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                        AND: {
                            OR: [{ arrivalStatus: 'PENDING' }, { arrivalStatus: 'ABSENT' }],
                        },
                    },
                    orderBy: { startTime: 'desc' },
                });

                const data: CreateAttendanceDto = {
                    startTime: actionTime,
                    arrivalStatus: status,
                    employeeId,
                    organizationId,
                    lateArrivalTime: diffMinutes,
                };

                if (existingAttendance) {
                    await this.prisma.attendance.update({
                        where: { id: existingAttendance.id },
                        data,
                    });
                } else {
                    await this.attendanceService.create(data);
                }

                await this.updatedGoneStatus(employeeId, organizationId, todayStart, todayEnd);
            }

            return this.prisma.action.create({
                data: {
                    actionTime: dto.actionTime,
                    visitorType: dto.visitorType,
                    entryType: dto.entryType,
                    actionType: dto.actionType,
                    actionResult: dto.actionResult,
                    actionMode: dto.actionMode,

                    device: {
                        connect: { id: deviceId },
                    },
                    gate: {
                        connect: { id: gate.id },
                    },
                    employee: {
                        connect: { id: employeeId },
                    },
                    organization: {
                        connect: { id: organizationId },
                    },
                },
            });
        } catch (error) {
            this.logger.error(error);
            throw new Error(error.message);
        }
    }

    async findOne(id: number, scope: DataScope) {
        const action = await this.repo.findById(id, this.repo.getDefaultInclude(), scope);
        if (!action) throw new NotFoundException(`Action ${id} not found`);
        return action;
    }

    async findAll(query: ActionQueryDto, scope: DataScope) {
        const where: Prisma.ActionWhereInput = {};

        const { startDate, endDate, search, deviceId, employeeId, status, sort, order } = query;

        if (deviceId) where.deviceId = Number(query.deviceId);
        if (employeeId) where.employeeId = Number(query.employeeId);
        if (status) where.status = query.status;

        if (search) {
            where.employee = {
                name: {
                    contains: query.search,
                    mode: 'insensitive',
                },
            };
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            where.actionTime = {
                gte: start,
                lte: end,
            };
        }

        const page = query.page ? Number(query.page) : 1;
        const limit = query.limit ? Number(query.limit) : 10;

        const data = await this.repo.findManyWithPagination(
            where,
            { [sort]: order },
            this.repo.getDefaultInclude(),
            { page, limit },
            scope
        );

        return data;
    }

    private async updatedGoneStatus(
        employeeId: number,
        organizationId: number,
        gte: Date,
        lte: Date
    ) {
        const existingAttendance = await this.prisma.attendance.findFirst({
            where: {
                employeeId,
                organizationId,
                createdAt: {
                    gte,
                    lte,
                },
            },
            orderBy: { startTime: 'desc' },
        });

        if (existingAttendance) {
            await this.prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                    goneStatus: null,
                    endTime: null,
                    earlyGoneTime: null,
                },
            });
        }
        return;
    }

    async getEnterStatus(
        actionTime: string,
        startTime: string,
        extraTime: string
    ): Promise<{ status: ActionStatus; diffMinutes: number }> {
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const [extraHour, extraMinute] = extraTime ? extraTime.split(':').map(Number) : [0, 0];

        const eventDate = this.parseLocalTime(actionTime);
        const startDateTime = new Date();

        startDateTime.setHours(startHour, startMinute, 0, 0);

        const allowedTime = new Date(startDateTime);
        allowedTime.setHours(startDateTime.getHours() + extraHour);
        allowedTime.setMinutes(startDateTime.getMinutes() + extraMinute);

        // kech qolgan vaqt
        const diffMs = eventDate.getTime() - allowedTime.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes > 0) {
            return { status: ActionStatus.LATE, diffMinutes };
        }

        return { status: ActionStatus.ON_TIME, diffMinutes: 0 };
    }

    async getExitStatus(
        actionTime: string,
        endTime: string
    ): Promise<{ status: ActionStatus; diffMinutes: number }> {
        const [endHour, endMinute] = endTime.split(':').map(Number);

        const eventDate = new Date(actionTime);

        const endDateTime = new Date(actionTime);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        // erta ketgan vaqt
        const diffMs = endDateTime.getTime() - eventDate.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes > 0) {
            return { status: ActionStatus.EARLY, diffMinutes };
        }

        return { status: ActionStatus.ON_TIME, diffMinutes: 0 };
    }

    parseLocalTime(timeStr: string): Date {
        const [datePart, timePart] = timeStr.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [timeWithoutZone] = timePart.split('+');
        const [hour, minute, second] = timeWithoutZone.split(':').map(Number);

        const d = new Date();
        d.setFullYear(year);
        d.setMonth(month - 1);
        d.setDate(day);
        d.setHours(hour, minute, second, 0);
        return d;
    }

    async getLastActionInfo(employeeId: number, organizationId: number, gte: Date, lte: Date) {
        const lastAction = await this.prisma.action.findFirst({
            where: { employeeId, organizationId, actionTime: { gte, lte } },
            orderBy: { actionTime: 'desc' },
        });

        if (!lastAction) {
            return {
                canCreate: true,
                lastEntryType: null,
                nextEntryType: 'ENTER',
                minutesSinceLast: null,
            };
        }

        const now = new Date();
        const diffMs = now.getTime() - new Date(lastAction.actionTime).getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) {
            return {
                canCreate: false,
                lastEntryType: lastAction.entryType,
                nextEntryType: lastAction.entryType,
                minutesSinceLast: diffMinutes,
            };
        }

        const nextEntryType =
            lastAction.entryType === 'ENTER'
                ? 'EXIT'
                : lastAction.entryType === 'EXIT'
                ? 'ENTER'
                : 'ENTER';

        return {
            canCreate: true,
            lastEntryType: lastAction.entryType,
            nextEntryType,
            minutesSinceLast: diffMinutes,
        };
    }
}
