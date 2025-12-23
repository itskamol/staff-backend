import { DataScope } from '@app/shared/auth';
import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Gate, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';
import { AssignGateWithOrgDto } from '../dto/gate.dto';

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

    protected cascadeRelations = [];

    protected disconnectRelations = ['organizations', 'employees'];

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
                    employees: true,
                },
            },
        });
    }

    async findWithDevices(id: number, scope: DataScope) {
        return this.findById(
            id,
            {
                devices: {
                    where: { isActive: true },
                    orderBy: { name: 'asc' },
                },
            },
            scope
        );
    }

    async getGateStatistics(id: number, scope: DataScope) {
        const gate = await this.findById(
            id,
            {
                devices: true,
                _count: {
                    select: {
                        devices: true,
                        employees: true,
                    },
                },
            },
            scope
        );

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

        const totalEmployee = await this.prisma.gate
            .findFirst({
                where: { id },
                select: {
                    employees: true,
                },
            })
            .then(g => g?.employees || []);

        return {
            totalDevices: (gate as any)._count.devices,
            activeDevices,
            totalActions: (gate as any)._count.actions,
            todayActions,
            totalEmployee: totalEmployee.length,
        };
    }
}
