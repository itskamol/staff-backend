import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope } from '@app/shared/auth';
import { UserContext } from '../../../shared/interfaces';
import { GateRepository } from '../repositories/gate.repository';
import { Prisma } from '@prisma/client';
import { CreateGateDto, UpdateGateDto } from '../dto/gate.dto';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

@Injectable()
export class GateService {
    constructor(private readonly gateRepository: GateRepository) {}

    async findAll(query: QueryDto, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, isDeleted } = query;
        const where: Prisma.GateWhereInput = {};

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        if (!isDeleted) {
            where.deletedAt = null;
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
                organization: {
                    select: {
                        fullName: true,
                    },
                },
                _count: {
                    select: {
                        devices: true,
                        employees: true,
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
                            select: { actions: true },
                        },
                    },
                },
                employees: {
                    select: {
                        id: true,
                    },
                },
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
            throw new NotFoundException('Gate not found');
        }

        return gate;
    }

    async create(createGateDto: CreateGateDto, scope: DataScope) {
        const organizationId = createGateDto.organizationId
            ? createGateDto.organizationId
            : scope.organizationId;

        const dto = { ...createGateDto, organizationId };
        return this.gateRepository.create(
            { ...dto },
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
                        devices: true,
                        employees: true,
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
}
