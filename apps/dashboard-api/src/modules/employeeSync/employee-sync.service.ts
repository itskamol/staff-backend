import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { GetEmployeeSyncDto } from './get-employee-sync.dto';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class EmployeeSyncService {
  private prisma = new PrismaClient();

  async findAll(query: GetEmployeeSyncDto, scope: DataScope, user: UserContext) {

    let organizationId = scope?.organizationId
    if (!organizationId && user.role != "ADMIN") {
      throw new NotFoundException('User organizationId not found!')
    }

    const { page = 1, limit = 10, status, gateId, sortBy = 'createdAt', order = 'desc' } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      ...(status && { status }),
      ...(gateId && { gateId }),
      ...(organizationId && {organizationId})
    };

    const orderBy: Prisma.EmployeeSyncOrderByWithRelationInput = {
      [sortBy]: order,
    };

    const [data, total] = await Promise.all([
      this.prisma.employeeSync.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          gate: { select: { id: true, name: true } }, // gate relation
          employee: {select: {id: true, name: true, photo: true}},
          organization: {select: {id: true, fullName: true}}
        },
      }),
      this.prisma.employeeSync.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit
    };
  }
}
