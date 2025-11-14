import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { CreateActionDto, UpdateActionDto } from '../dto/action.dto';

@Injectable()
export class ActionRepository {
  private prisma = new PrismaClient();

  async create(data: CreateActionDto) {
    const payload: any = { ...data };
    if (data.actionTime) payload.actionTime = new Date(data.actionTime);
    return this.prisma.action.create({ data: payload });
  }

  async findOne(id: string) {
    return this.prisma.action.findUnique({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
  }) {
    const { skip = 0, take = 50, where = {}, orderBy = { actionTime: 'desc' } } = params;
    return this.prisma.action.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        employee: {
          select: {
            name: true,
            photo: true,
            phone: true
          }
        }
      }
    });
  }

  async update(id: string, data: UpdateActionDto) {
    const payload: any = { ...data };
    if (data.actionTime) payload.actionTime = new Date(data.actionTime);
    return this.prisma.action.update({ where: { id }, data: payload });
  }

  async remove(id: string) {
    return this.prisma.action.delete({ where: { id } });
  }

  async count(where: any) {
  return this.prisma.action.count({ where });
}
}