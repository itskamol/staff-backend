import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionRepository } from '../repositories/action.repository';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { PrismaService } from '@app/shared/database';
import {
    ActionMode,
    ActionStatus,
    ActionType,
    EntryType,
    OnetimeCode,
    Prisma,
    VisitorCodeType,
    VisitorType,
} from '@prisma/client';
import { AttendanceService } from '../../attendance/attendance.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { DataScope } from '@app/shared/auth';
import { CreateAttendanceDto } from '../../attendance/dto/attendance.dto';
import { OnetimeCodeService } from '../../onetime-codes/services/onetime-code.service';

@Injectable()
export class ActionService {
    s;
    constructor(
        private readonly actionRepo: ActionRepository,
        private readonly attendanceService: AttendanceService,
        private prisma: PrismaService,
        private readonly logger: LoggerService,
        private readonly onetimeCodeService: OnetimeCodeService
    ) {}

    async create(eventData: any, deviceId: number, id: string) {
        try {
            const acEvent =
                eventData.AccessControllerEvent || eventData.EventNotificationAlert || {};
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

            const visitorType =
                acEvent.userType === 'visitor' ? VisitorType.VISITOR : VisitorType.EMPLOYEE;

            const entityId =
                visitorType === VisitorType.VISITOR ? parseInt(id.replace('v', '')) : parseInt(id);

            const isAccessDenied = [8, 9, 11, 12].includes(acEvent.subEventType);

            if (isAccessDenied) {
                this.logger.warn(
                    `Access Denied: SubEventType ${acEvent.subEventType} for entity ${entityId}`
                );
                return true;
            }

            let credentialId: number | null = null;
            let onetimeCodeId: number | null = null;

            if (visitorType === VisitorType.EMPLOYEE) {
                // Xodimlar uchun credential qidirish (eski logika)
                if (actionType === CAR || actionType === CARD) {
                    const credential = await this.prisma.credential.findFirst({
                        where: { code: originalLicensePlate || acEvent?.cardNo, isActive: true },
                    });
                    credentialId = credential ? credential.id : null;
                } else if (actionType === PHOTO || actionType === PERSONAL_CODE) {
                    const credential = await this.prisma.credential.findFirst({
                        where: { employeeId: entityId, type: actionType, isActive: true },
                    });
                    credentialId = credential ? credential.id : null;
                }
            } else {
                const visitorCode = await this.prisma.onetimeCode.findFirst({
                    where: {
                        visitorId: entityId,
                        code: acEvent?.cardNo || acEvent?.passWord || String(acEvent.employeeNo),
                        isActive: true,
                    },
                });
                onetimeCodeId = visitorCode ? visitorCode.id : null;
            }

            const device = await this.prisma.device.findFirst({ where: { id: deviceId } });
            if (!device) throw new Error(`Device ${deviceId} not found!`);

            let person = null;
            if (visitorType === VisitorType.EMPLOYEE) {
                person = await this.prisma.employee.findFirst({
                    where: { id: entityId },
                    include: { plan: true },
                });
            } else {
                person = await this.prisma.visitor.findFirst({
                    where: { id: entityId },
                });
            }

            if (!person) throw new Error(`${visitorType} ${entityId} not found`);

            const organizationId = person.organizationId;
            const plan = visitorType === VisitorType.EMPLOYEE ? (person as any).plan : null;

            const dto: CreateActionDto = {
                deviceId,
                gateId: device?.gateId || null,
                actionTime: new Date(actionTime),
                employeeId: visitorType === VisitorType.EMPLOYEE ? entityId : null,
                visitorId: visitorType === VisitorType.VISITOR ? entityId : null,
                visitorType,
                entryType: device.entryType,
                actionType,
                actionResult: null,
                actionMode:
                    eventData.eventState === 'active' || acEvent.eventState === 'active'
                        ? ActionMode.ONLINE
                        : ActionMode.OFFLINE,
                organizationId,
                credentialId,
                onetimeCodeId,
            };

            const todayStart = new Date(actionTime);
            todayStart.setHours(0, 0, 0, 0);
            const todayEnd = new Date(actionTime);
            todayEnd.setHours(23, 59, 59, 999);

            if (device.entryType === EntryType.BOTH) {
                const lastInfo = await this.getLastActionInfo(
                    entityId,
                    organizationId,
                    todayStart,
                    todayEnd,
                    visitorType,
                    onetimeCodeId
                );

                if (!lastInfo.canCreate) return;
                dto.entryType = lastInfo.nextEntryType as any;
            }

            if (onetimeCodeId) {
                const oneTimeCode = await this.prisma.onetimeCode.findFirst({
                    where: { id: onetimeCodeId },
                });

                if (oneTimeCode.codeType === VisitorCodeType.ONETIME)
                    await this.checkOneTimeCode(onetimeCodeId, dto.entryType);
            }

            if (visitorType === VisitorType.EMPLOYEE && plan) {
                if (dto.entryType === EntryType.EXIT) {
                    const { status: exitStatus, diffMinutes } = await this.getExitStatus(
                        actionTime,
                        plan.endTime
                    );
                    const existing = await this.attendanceService.findFirst(
                        {
                            employeeId: entityId,
                            organizationId,
                            startTime: { gte: todayStart, lte: todayEnd },
                        },
                        { startTime: 'desc' }
                    );
                    if (existing) {
                        await this.attendanceService.update(existing.id, {
                            endTime: actionTime,
                            goneStatus: existing?.isWorkingDay ? exitStatus : 'ON_TIME',
                            earlyGoneTime: existing?.isWorkingDay ? diffMinutes : 0,
                        });
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
                            employeeId: entityId,
                            organizationId,
                            createdAt: { gte: todayStart, lte: todayEnd },
                            AND: {
                                OR: [
                                    { arrivalStatus: ActionStatus.PENDING },
                                    { arrivalStatus: ActionStatus.ABSENT },
                                ],
                            },
                        },
                        { startTime: 'desc' }
                    );

                    const attData: CreateAttendanceDto = {
                        startTime: actionTime,
                        arrivalStatus: status,
                        employeeId: entityId,
                        organizationId,
                        lateArrivalTime: diffMinutes,
                    };

                    if (existing) {
                        await this.attendanceService.update(existing.id, {
                            ...attData,
                            arrivalStatus: existing?.isWorkingDay ? status : 'ON_TIME',
                            lateArrivalTime: existing?.isWorkingDay ? diffMinutes : 0,
                        });
                    } else {
                        await this.attendanceService.create(attData);
                    }
                    await this.updatedGoneStatus(entityId, organizationId, todayStart, todayEnd);
                }
            }

            return this.actionRepo.create({
                actionTime: dto.actionTime,
                visitorType: dto.visitorType,
                entryType: dto.entryType,
                actionType: dto.actionType || null,
                actionResult: dto.actionResult,
                actionMode: dto.actionMode,
                device: { connect: { id: deviceId } },
                gate: { connect: { id: device?.gateId || null } },
                organization: { connect: { id: organizationId } },
                ...(visitorType === VisitorType.EMPLOYEE
                    ? { employee: { connect: { id: entityId } } }
                    : { visitor: { connect: { id: entityId } } }),
                ...(credentialId && { credential: { connect: { id: credentialId } } }),
                ...(onetimeCodeId && { onetimeCode: { connect: { id: onetimeCodeId } } }),
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
        const { startDate, endDate, search, deviceId, employeeId, status, sort, order, visitorId } = query;

        if (deviceId) where.deviceId = deviceId;
        if (employeeId) where.employeeId = employeeId;
        if (status) where.status = status;
        if (visitorId) where.visitorId = visitorId;

        
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
            {
                ...where
            },
            { [sort || 'actionTime']: order || 'asc' },
            this.actionRepo.getDefaultInclude(),
            undefined,
            undefined,
            { organizationId: scope?.organizationId },
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

    async getLastActionInfo(
        entityId: number,
        organizationId: number,
        gte: Date,
        lte: Date,
        visitorType: VisitorType,
        onetimeCodeId?: number
    ) {
        const where: any = { organizationId, actionTime: { gte, lte } };

        // Kimligiga qarab filtrlash
        if (visitorType === VisitorType.EMPLOYEE) {
            where.employeeId = entityId;
        } else {
            where.visitorId = entityId;
            where.onetimeCodeId = onetimeCodeId;
        }

        const lastAction = await this.actionRepo.findFirst(where, { actionTime: 'desc' });
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

    private async checkOneTimeCode(id: number, entryType: EntryType) {
        if (entryType === EntryType.EXIT) {
            await this.onetimeCodeService.deactivate(id);
            return;
        }

        const actions = await this.prisma.action.count({
            where: { onetimeCodeId: id, entryType: 'ENTER' },
        });

        if (actions > 0) {
            await this.onetimeCodeService.deactivate(id);
        }
        return;
    }
}
