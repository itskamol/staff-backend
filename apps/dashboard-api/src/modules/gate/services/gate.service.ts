import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { UserContext } from '../../../shared/interfaces';
import { GateRepository } from '../repositories/gate.repository';
import { Prisma } from '@prisma/client';
import { CreateGateDto, UpdateGateDto } from '../dto/gate.dto';

@Injectable()
export class GateService {
    constructor(
        private readonly gateRepository: GateRepository
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
                },
                _count: {
                    select: {
                        devices: true,
                        actions: true,
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const gate = await this.gateRepository.findById(id, {
            devices: {
                include: {
                    _count: {
                        select: { actions: true },
                    },
                },
            },
            actions: {
                take: 10,
                orderBy: { actionTime: 'desc' },
                include: {
                    device: { select: { id: true, name: true } },
                    employee: { select: { id: true, name: true } },
                },
            },
            _count: {
                select: {
                    devices: true,
                    actions: true,
                },
            },
        });

        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        return gate;
    }

    async create(createGateDto: CreateGateDto, scope: DataScope) {

        return this.gateRepository.create(
            { ...createGateDto },
            {
                _count: {
                    select: {
                        devices: true,
                        actions: true,
                    },
                },
            },
            scope
        );
    }

    async update(id: number, updateGateDto: UpdateGateDto, user: UserContext) {
        await this.findOne(id, user);

        return this.gateRepository.update(id, updateGateDto, {
            _count: {
                select: {
                    devices: true,
                    actions: true,
                },
            },
        });
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const gate = await this.gateRepository.findById(
            id,
            {
                _count: {
                    select: {
                        devices: true,
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

        return this.gateRepository.delete(id, scope);
    }

    async getGateStatistics(id: number, user: UserContext) {
        const statistics = await this.gateRepository.getGateStatistics(id);

        if (!statistics) {
            throw new NotFoundException('Gate not found');
        }

        return statistics;
    }

    async getGateWithDevices(id: number, user: UserContext) {
        const gate = await this.gateRepository.findWithDevices(id);

        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        return gate;
    }

    async findByName(name: string) {
        return this.gateRepository.findByName(name);
    }
}