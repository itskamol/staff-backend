import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionRepository } from '../repositories/action.repository';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { PrismaService } from '@app/shared/database';
import {
    ActionMode,
    ActionStatus,
    ActionType,
    EntryType,
    Prisma,
    VisitorType,
} from '@prisma/client';
import { AttendanceService } from '../../attendance/attendance.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { DataScope } from '@app/shared/auth';
import { CreateAttendanceDto } from '../../attendance/dto/attendance.dto';

@Injectable()
export class ActionService {
    constructor(
        private readonly actionRepo: ActionRepository,
        private readonly attendanceService: AttendanceService,
        private prisma: PrismaService,
        private readonly logger: LoggerService
    ) {}

    async create(eventData: any, deviceId: number, employeeId: number) {
        try {
            const acEvent =
                eventData.AccessControllerEvent || eventData.EventNotificationAlert || {};

            // subeventType: 75 - photo, 181 - personal code, 1 - card+
            const { CAR, CARD, PERSONAL_CODE, PHOTO } = ActionType;

            const actionTime = eventData.dateTime || acEvent.dateTime;
            const originalLicensePlate = acEvent?.ANPR?.originalLicensePlate || null;

            let actionType = originalLicensePlate
                ? CAR
                : acEvent.subEventType == 181
                ? PERSONAL_CODE
                : acEvent.subEventType == 75
                ? PHOTO
                : acEvent.subEventType == 1
                ? CARD
                : null;

            let credentialId = null;

            if (actionType == CAR || actionType == CARD) {
                const credential = await this.prisma.credential.findFirst({
                    where: { code: originalLicensePlate || acEvent?.cardNo, isActive: true },
                });
                credentialId = credential ? credential.id : null;
            }

            if (actionType == PHOTO || actionType == PERSONAL_CODE) {
                const credential = await this.prisma.credential.findFirst({
                    where: { employeeId, type: actionType, isActive: true },
                });

                credentialId = credential ? credential.id : null;
            }

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
                    acEvent.userType === 'normal' || device.type.includes(ActionType.CAR)
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
                credentialId,
            };

            const todayStart = new Date(actionTime);
            todayStart.setHours(0, 0, 0, 0);

            const todayEnd = new Date(actionTime);
            todayEnd.setHours(23, 59, 59, 999);

            if (device.entryType === EntryType.BOTH) {
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

            if (dto.entryType === EntryType.EXIT) {
                const { status: exitStatus, diffMinutes } = await this.getExitStatus(
                    actionTime,
                    plan.endTime
                );

                const existing = await this.attendanceService.findFirst(
                    {
                        employeeId,
                        organizationId,
                        startTime: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                    },
                    { startTime: 'desc' }
                );

                if (existing) {
                    await this.attendanceService.update(existing.id, {
                        endTime: actionTime,
                        goneStatus: existing?.isWorkingDay ? exitStatus : 'ON_TIME',
                        earlyGoneTime: existing?.isWorkingDay ? diffMinutes : 0,
                    });
                } else {
                    this.logger.warn(`⚠️ Attendance NOT FOUND (EXIT): employee ${employeeId}`);
                }
            }

            if (dto.entryType === EntryType.ENTER) {
                const { status, diffMinutes } = await this.getEnterStatus(
                    actionTime,
                    plan.startTime,
                    plan.extraTime
                );

                const existing = await this.attendanceService.findFirst(
                    {
                        employeeId,
                        organizationId,
                        createdAt: {
                            gte: todayStart,
                            lte: todayEnd,
                        },
                        AND: {
                            OR: [
                                { arrivalStatus: ActionStatus.PENDING },
                                { arrivalStatus: ActionStatus.ABSENT },
                            ],
                        },
                    },
                    { startTime: 'desc' }
                );

                const data: CreateAttendanceDto = {
                    startTime: actionTime,
                    arrivalStatus: status,
                    employeeId,
                    organizationId,
                    lateArrivalTime: diffMinutes,
                };

                if (existing) {
                    await this.attendanceService.update(existing.id, {
                        ...data,
                        arrivalStatus: existing?.isWorkingDay ? status : 'ON_TIME',
                        lateArrivalTime: existing?.isWorkingDay ? diffMinutes : 0,
                    });
                    await this.attendanceService.update(existing.id, data);
                } else {
                    await this.attendanceService.create(data);
                }

                await this.updatedGoneStatus(employeeId, organizationId, todayStart, todayEnd);
            }

            return this.actionRepo.create({
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
                credential: credentialId
                    ? {
                          connect: { id: credentialId },
                      }
                    : undefined,
            });
        } catch (error) {
            this.logger.error(error);
            throw new Error(error.message);
        }
    }

    async findOne(id: number, scope: DataScope) {
        const action = await this.actionRepo.findById(
            id,
            this.actionRepo.getDefaultInclude(),
            scope
        );
        if (!action) throw new NotFoundException(`Action ${id} not found`);
        return action;
    }

    async findAll(query: ActionQueryDto, scope: DataScope) {
        const where: Prisma.ActionWhereInput = {};
        const { startDate, endDate, search, deviceId, employeeId, status, sort, order } = query;

        if (deviceId) where.deviceId = Number(deviceId);
        if (employeeId) where.employeeId = Number(employeeId);
        if (status) where.status = status;

        if (search) {
            where.employee = {
                name: {
                    contains: search,
                    mode: 'insensitive',
                },
            };
        }

        let start: Date;
        let end: Date;

        if (startDate && endDate) {
            start = new Date(startDate);
            start.setHours(0, 0, 0, 0);

            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            start = new Date();
            start.setHours(0, 0, 0, 0);

            end = new Date();
            end.setHours(23, 59, 59, 999);
        }

        where.actionTime = {
            gte: start,
            lte: end,
        };

        const actions = await this.actionRepo.findMany(
            where,
            { [sort || 'actionTime']: order || 'asc' },
            this.actionRepo.getDefaultInclude(),
            undefined,
            undefined,
            scope,
            true
        );

        const dates = this.getDateRange(start, end);

        return dates.map(date => {
            const dateWithOffset = new Date(date);
            dateWithOffset.setDate(dateWithOffset.getDate() + 1);

            const dateStr = dateWithOffset.toISOString().split('T')[0];

            return {
                date: dateStr,
                dayName: date.toLocaleDateString('en-US', { weekday: 'long' }),
                actions: actions.filter(
                    action => new Date(action.actionTime).toISOString().split('T')[0] === dateStr
                ),
            };
        });
    }

    private getDateRange(start: Date, end: Date): Date[] {
        const dates: Date[] = [];
        const current = new Date(start);

        while (current <= end) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    private async updatedGoneStatus(
        employeeId: number,
        organizationId: number,
        gte: Date,
        lte: Date
    ) {
        const existing = await this.attendanceService.findFirst(
            {
                employeeId,
                organizationId,
                createdAt: {
                    gte,
                    lte,
                },
            },
            { startTime: 'desc' }
        );

        if (existing) {
            await this.attendanceService.update(existing.id, {
                goneStatus: null,
                endTime: null,
                earlyGoneTime: null,
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
        const lastAction = await this.actionRepo.findFirst(
            { employeeId, organizationId, actionTime: { gte, lte } },
            { actionTime: 'desc' }
        );
        const { EXIT, ENTER } = EntryType;

        if (!lastAction) {
            return {
                canCreate: true,
                lastEntryType: null,
                nextEntryType: ENTER,
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
            lastAction.entryType === ENTER ? EXIT : lastAction.entryType === EXIT ? ENTER : ENTER;

        return {
            canCreate: true,
            lastEntryType: lastAction.entryType,
            nextEntryType,
            minutesSinceLast: diffMinutes,
        };
    }
}
