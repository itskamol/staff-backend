import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Gate, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class GateRepository extends BaseRepository<
    Gate,
    Prisma.GateCreateInput,
    Prisma.GateUpdateInput,
    Prisma.GateWhereInput,
    Prisma.GateWhereUniqueInput,
    Prisma.GateOrderByWithRelationInput,
    Prisma.GateInclude,
    Prisma.GateSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Gate;

    protected getDelegate() {
        return this.prisma.gate;
    }

    async findByName(name: string) {
        return this.findFirst({ name });
    }

    async findWithDeviceCount(where?: Prisma.GateWhereInput) {
        return this.findMany(where, undefined, {
            _count: {
                select: {
                    devices: true,
                    gateEmployees: true,
                },
            },
        });
    }

    async findWithDevices(id: string) {
        return this.findById(id, {
            devices: {
                where: { isActive: true },
                orderBy: { name: 'asc' },
            },
        });
    }

    async getGateStatistics(id: string) {
        const gate = await this.findById(id, {
            devices: true,
            _count: {
                select: {
                    devices: true,
                    gateEmployees: true,
                },
            },
        });

        if (!gate) {
            return null;
        }

        const activeDevices = (gate.devices || []).filter(d => d.isActive).length;

        const todayActions = await this.prisma.action.count({
            where: {
                gateId: id,
                actionTime: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        });

        const totalEmployee = await this.prisma.gateEmployee.groupBy({
            by: ['employeeId'],
            where: {
                gateId: id
            },
            _count: {
                employeeId: true,
            },
        });

        return {
            totalDevices: (gate as any)._count.devices,
            activeDevices,
            totalActions: (gate as any)._count.actions,
            todayActions,
            totalEmployee: totalEmployee.length
        };
    }
}