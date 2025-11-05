// ...existing code...
import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionRepository } from '../repositories/action.repository';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { PrismaService } from '@app/shared/database';

@Injectable()
export class ActionService {
  constructor(private readonly repo: ActionRepository,
    private prisma: PrismaService
  ) { }

  async create(dto: CreateActionDto) {
    const device = await this.prisma.device.findFirst({ where: { id: dto.deviceId } })
    const gateId = device?.gateId
    dto.gateId = gateId
    return this.repo.create(dto);
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

    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 10;
    const skip = (page - 1) * limit;

    // 🧮 Total count (jami yozuvlar soni)
    const total = await this.repo.count(where);

    // 🔍 Ma’lumotlarni olish
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
}