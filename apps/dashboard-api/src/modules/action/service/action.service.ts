// ...existing code...
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActionRepository } from '../repositories/action.repository';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { PrismaService } from '@app/shared/database';
import { ActionMode, ActionStatus, ActionType, VisitorType } from '@prisma/client';

@Injectable()
export class ActionService {
  constructor(private readonly repo: ActionRepository,
    private prisma: PrismaService
  ) { }

  async create(eventData: any, deviceId: number) {
    const acEvent = eventData.AccessControllerEvent || {};
    const employeeId = acEvent.employeeNoString ? parseInt(acEvent.employeeNoString) : undefined;
    const actionTime = new Date(eventData.dateTime);

    const device = await this.prisma.device.findFirst({ where: { id: deviceId } });
    if (!device) throw new Error(`Device ${deviceId} topilmadi`);

    const gate = await this.prisma.gate.findFirst({ where: { id: device.gateId } });
    if (!gate) throw new Error(`Gate ${device.gateId} topilmadi`);

    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId } });
    if (!employee) throw new Error(`Employee ${employeeId} topilmadi`);

    if (!employee.employeePlanId) {
      throw new Error(`Employee ${employeeId} uchun reja (employeePlanId) mavjud emas`);
    }

    const plan = await this.prisma.employeePlan.findFirst({
      where: { id: employee.employeePlanId },
    });
    if (!plan) throw new Error(`Employee plan ${employee.employeePlanId} topilmadi`);

    const { status } = await this.getActionStatus(actionTime, plan.startTime, plan.extraTime);

    const dto: CreateActionDto = {
      deviceId,
      gateId: gate.id,
      actionTime: eventData.dateTime,
      employeeId,
      visitorId: undefined,
      visitorType:
        acEvent.userType === 'normal' ? VisitorType.EMPLOYEE : VisitorType.VISITOR,
      entryType: device.entryType,
      actionType: ActionType.PHOTO,
      actionResult: null,
      actionMode:
        eventData.eventState === 'active' ? ActionMode.ONLINE : ActionMode.OFFLINE,
      status,
      organizationId: gate.organizationId,
    };

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


  async getActionStatus(actionTime: Date, startTime: string, extraTime: string): Promise<{ status: ActionStatus }> {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [extraHour, extraMinute] = extraTime ? extraTime.split(':').map(Number) : [0, 0];

    const eventDate = new Date(actionTime);
    const startDateTime = new Date(eventDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const allowedTime = new Date(startDateTime);
    allowedTime.setHours(startDateTime.getHours() + extraHour);
    allowedTime.setMinutes(startDateTime.getMinutes() + extraMinute);

    const diffMs = actionTime.getTime() - allowedTime.getTime();

    if (diffMs > 0) {
      return {
        status: ActionStatus.LATE,
      };
    } else {
      return {
        status: ActionStatus.ON_TIME,
      };
    }
  }
}