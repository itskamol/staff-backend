import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { GetEmployeeSyncDto } from './get-employee-sync.dto';

@Injectable()
export class EmployeeSyncService {
  private prisma = new PrismaClient();

  async findAll(query: GetEmployeeSyncDto) {
    const { page = 1, limit = 10, status, gateId, sortBy = 'createdAt', order = 'desc' } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      ...(status && { status }),
      ...(gateId && { gateId }),
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
        },
      }),
      this.prisma.employeeSync.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }
}
