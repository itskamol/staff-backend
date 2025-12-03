import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope } from '@app/shared/auth';
import { UserContext } from '../../../shared/interfaces';
import { GateRepository } from '../repositories/gate.repository';
import { Prisma } from '@prisma/client';
import { AssignGateWithOrgDto, CreateGateDto, UpdateGateDto } from '../dto/gate.dto';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';
import { PrismaService } from '@app/shared/database';
import { InjectQueue } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Queue } from 'bullmq';

@Injectable()
export class GateService {
    constructor(
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue,
        private readonly gateRepository: GateRepository,
        private readonly prisma: PrismaService
    ) {}

    async findAll(query: QueryDto, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search } = query;
        const where: Prisma.GateWhereInput = {};

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        return this.gateRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                devices: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        entryType: true,
                    },
                    where: { deletedAt: null },
                },
                organizations: {
                    select: {
                        fullName: true,
                    },
                },
                _count: {
                    select: {
                        devices: { where: { deletedAt: null } },
                        employees: { where: { deletedAt: null } },
                        organizations: { where: { deletedAt: null } },
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, scope: DataScope) {
        const gate = await this.gateRepository.findById(
            id,
            {
                devices: {
                    include: {
                        _count: {
                            select: { actions: { where: { deletedAt: null } } },
                        },
                    },
                },
                employees: {
                    select: {
                        id: true,
                    },
                    where: {
                        deletedAt: null,
                    },
                },
                _count: {
                    select: {
                        devices: { where: { deletedAt: null } },
                        employees: { where: { deletedAt: null } },
                        organizations: { where: { deletedAt: null } },
                    },
                },
            },
            scope
        );

        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        return gate;
    }

    async create(createGateDto: CreateGateDto, scope: DataScope) {
        const { organizationsIds, name, isActive } = createGateDto;
        return this.gateRepository.create(
            {
                name,
                isActive,
                organizations: {
                    connect: organizationsIds?.map((id: number) => ({ id })),
                },
            },
            {
                _count: {
                    select: {
                        organizations: { where: { deletedAt: null } },
                    },
                },
            },
            scope
        );
    }

    async update(id: number, updateGateDto: UpdateGateDto, scope: DataScope) {
        await this.findOne(id, scope);

        return this.gateRepository.update(
            id,
            updateGateDto,
            {
                _count: {
                    select: {
                        devices: true,
                        employees: true,
                    },
                },
            },
            scope
        );
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const gate = await this.gateRepository.findById(
            id,
            {
                _count: {
                    select: {
                        devices: { where: { deletedAt: null } },
                        employees: { where: { deletedAt: null } },
                    },
                },
            },
            scope
        );

        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        if ((gate as any)._count?.devices > 0) {
            throw new BadRequestException(
                `Cannot delete gate with ${(gate as any)._count.devices} connected devices`
            );
        }

        return this.gateRepository.softDelete(id, scope);
    }

    async getGateStatistics(id: number, scope: DataScope) {
        const statistics = await this.gateRepository.getGateStatistics(id, scope);

        if (!statistics) {
            throw new NotFoundException('Gate not found');
        }

        return statistics;
    }

    async getGateWithDevices(id: number, scope: DataScope) {
        const gate = await this.gateRepository.findWithDevices(id, scope);

        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        return gate;
    }

    async findByName(name: string) {
        return this.gateRepository.findByName(name);
    }

    async assignGateWithOrg(data: AssignGateWithOrgDto) {
        const { organizationsIds, gatesIds } = data;

        for (const id of gatesIds) {
            await this.updateGateOrganization(id, organizationsIds);
        }

        return { success: true };
    }

    private async updateGateOrganization(gateId: number, orgsIds: number[]) {
        const gate = await this.prisma.gate.findUnique({
            where: { id: gateId },
            select: {
                organizations: { select: { id: true, employees: { where: { deletedAt: null } } } },
            },
        });

        const oldOrgIds = gate.organizations.map(e => e.id);

        const toConnect = orgsIds.filter(id => !oldOrgIds.includes(id));
        const toDisconnect = oldOrgIds.filter(id => !orgsIds.includes(id));

        await this.prisma.gate.update({
            where: { id: gateId },
            data: {
                organizations: {
                    connect: toConnect.map(id => ({ id })),
                    disconnect: toDisconnect.map(id => ({ id })),
                },
            },
        });

        const employees = gate.organizations
            .filter(org => toDisconnect.includes(org.id))
            .flatMap(org => org.employees);

        const employeeIds = employees.filter(e => e.deletedAt === null).map(e => e.id);

        if (employeeIds.length !== 0) {
            await this.prisma.gate.update({
                where: { id: gateId },
                data: {
                    employees: {
                        disconnect: employeeIds.map(id => ({ id })),
                    },
                },
            });

            await this.deviceQueue.add(JOB.DEVICE.REMOVE_GATE_EMPLOYEE_DATA, {
                gateId,
                employeeIds,
            });
        }

        return { connected: toConnect, disconnected: toDisconnect };
    }
}
