import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { CreateAttendanceDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { ActionStatus, Prisma } from '@prisma/client';

@Injectable()
export class AttendanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAttendanceDto) {
  return this.prisma.attendance.create({
    data: {
      ...data,
      employeeId: data.employeeId,
      organizationId: data.organizationId,
    } as Prisma.AttendanceUncheckedCreateInput,
  });
}

  async findById(id: string) {
    return this.prisma.attendance.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, photo: true } },
      },
    });
  }

  async update(id: string, data: UpdateAttendanceDto) {
  return this.prisma.attendance.update({
    where: { id },
    data: {
      ...data,
      arrivalStatus: data.arrivalStatus as ActionStatus,
      goneStatus: data.goneStatus as ActionStatus,
    } as Prisma.AttendanceUncheckedUpdateInput,
  });
}

  async delete(id: string) {
    return this.prisma.attendance.delete({ where: { id } });
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
    include?: any;
  }) {
    const { skip = 0, take = 50, where = {}, orderBy = { startTime: 'desc' }, include } = params;
    const args: any = { skip, take, where, orderBy };
    if (include) args.include = include;
    return this.prisma.attendance.findMany(args);
  }

  async count(where: any = {}) {
    return this.prisma.attendance.count({ where });
  }
}