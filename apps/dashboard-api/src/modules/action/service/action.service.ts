import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionRepository } from '../repositories/action.repository';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { PrismaService } from '@app/shared/database';
import { ActionMode, ActionStatus, ActionType, VisitorType } from '@prisma/client';
import { AttendanceService } from '../../attendance/attendance.service';
import { CreateAttendanceDto } from '../../attendance/dto/attendance.dto';

@Injectable()
export class ActionService {
  constructor(private readonly repo: ActionRepository,
    private prisma: PrismaService,
    private attendanceService: AttendanceService

  ) { }

  async create(eventData: any, deviceId: number) {
    const acEvent = eventData.AccessControllerEvent || {};
    const employeeId = acEvent.employeeNoString ? parseInt(acEvent.employeeNoString) : undefined;
    const actionTime = eventData.dateTime;
    console.log('actionTime:', actionTime)

    const device = await this.prisma.device.findFirst({ where: { id: deviceId } });
    if (!device) throw new Error(`Device ${deviceId} not found!`);

    const gate = await this.prisma.gate.findFirst({ where: { id: device.gateId } });
    if (!gate) throw new Error(`Gate ${device.gateId} not found!`);

    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId } });
    if (!employee) throw new Error(`Employee ${employeeId} not found`);

    if (!employee.employeePlanId) {
      throw new Error(`EmployeePlan is not found for Employee`);
    }

    const plan = await this.prisma.employeePlan.findFirst({
      where: { id: employee.employeePlanId },
    });
    if (!plan) throw new Error(`Employee plan ${employee.employeePlanId} not found`);

    const { status } = await this.getActionStatus(actionTime, plan.startTime, plan.extraTime);

    const dto: CreateActionDto = {
      deviceId,
      gateId: gate.id,
      actionTime,
      employeeId,
      visitorId: undefined,
      visitorType: acEvent.userType === 'normal' ? VisitorType.EMPLOYEE : VisitorType.VISITOR,
      entryType: device.entryType,
      actionType: ActionType.PHOTO,
      actionResult: null,
      actionMode: eventData.eventState === 'active' ? ActionMode.ONLINE : ActionMode.OFFLINE,
      status,
      organizationId: gate.organizationId,
    };

    if (device.entryType === 'BOTH') {
      const lastInfo = await this.getLastActionInfo(employeeId, device.id);

      if (!lastInfo.canCreate) {
        return;
      }

      dto.entryType = lastInfo.nextEntryType as any;
    }

    if (dto.entryType === 'EXIT') {
      const { status: exitStatus } = await this.getExitStatus(actionTime, plan.endTime);

      const todayStart = new Date(actionTime);
      todayStart.setHours(0, 0, 0, 0);

      const todayEnd = new Date(actionTime);
      todayEnd.setHours(23, 59, 59, 999);

      const existingAttendance = await this.prisma.attendance.findFirst({
        where: {
          employeeId,
          organizationId: gate.organizationId,
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
          },
        });

      } else {
        console.warn(`⚠️ Attendance NOT FOUND (EXIT): employee ${employeeId}`);
      }
    }


    const attendance: CreateAttendanceDto = {
      startTime: actionTime,
      arrivalStatus: status,
      employeeId,
      organizationId: gate.organizationId,
    };

    const result = await this.attendanceService.create(attendance)
    console.log('attendance:', result)

    return this.prisma.action.create({ data: dto });
  }


  async findOne(id: number) {
    const action = await this.repo.findOne(id);
    if (!action) throw new NotFoundException(`Action ${id} not found`);
    return action;
  }

  async findAll(query: ActionQueryDto) {
    const where: any = {};

    if (query.deviceId) where.deviceId = Number(query.deviceId);
    if (query.employeeId) where.employeeId = Number(query.employeeId);
    if (query.status) where.status = query.status

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    const total = await this.repo.count(where);

    const data = await this.repo.findMany({
      skip,
      take: limit,
      where,
      orderBy: { actionTime: 'desc' },
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async update(id: number, dto: UpdateActionDto) {
    await this.findOne(id);
    return this.repo.update(id, dto);
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.repo.remove(id);
  }


  async toSimpleIso(dateStr: string): Promise<string> {
    const date = new Date(dateStr);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }


  async getActionStatus(
    actionTime: string,
    startTime: string,
    extraTime: string
  ): Promise<{ status: ActionStatus }> {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [extraHour, extraMinute] = extraTime ? extraTime.split(':').map(Number) : [0, 0];

    const eventDate = new Date(actionTime);
    console.log('eventDate', eventDate)
    const startDateTime = new Date(actionTime);

    startDateTime.setHours(startHour, startMinute, 0, 0);

    console.log('startTime', startDateTime)
    const allowedTime = new Date(startDateTime);

    allowedTime.setHours(startDateTime.getHours() + extraHour);
    allowedTime.setMinutes(startDateTime.getMinutes() + extraMinute);
    
    console.log('allowedTime', allowedTime)
    const diffMs = eventDate.getTime() - allowedTime.getTime();

    console.log('diffMs', diffMs);

    if (diffMs > 0) {
      return { status: ActionStatus.LATE };
    } else {
      return { status: ActionStatus.ON_TIME };
    }
  }

  async getExitStatus(
    actionTime: string,
    endTime: string
  ): Promise<{ status: ActionStatus }> {
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const eventDate = new Date(actionTime);

    const endDateTime = new Date(actionTime);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    const diffMs = eventDate.getTime() - endDateTime.getTime();

    if (diffMs < 0) {
      return { status: ActionStatus.EARLY };
    } else {
      return { status: ActionStatus.ON_TIME };
    }
  }


  async getLastActionInfo(employeeId: number, deviceId: number) {

    const lastAction = await this.prisma.action.findFirst({
      where: { employeeId, deviceId },
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