import { Injectable } from '@nestjs/common';
import { Prisma, Attendance } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class AttendanceRepository extends BaseRepository<
  Attendance,
  Prisma.AttendanceCreateInput,
  Prisma.AttendanceUpdateInput,
  Prisma.AttendanceWhereInput,
  Prisma.AttendanceWhereUniqueInput,
  Prisma.AttendanceOrderByWithRelationInput,
  Prisma.AttendanceInclude
> {
  protected readonly modelName = 'Attendance';

  constructor(protected readonly prisma: PrismaService) {
    super(prisma);
  }

  protected getDelegate() {
    return this.prisma.attendance;
  }
}
