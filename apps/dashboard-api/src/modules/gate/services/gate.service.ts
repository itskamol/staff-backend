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
    ) { }

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
                organization: {
                    select: {
                        fullName: true
                    }
                },
                _count: {
                    select: {
                        devices: true,
                        gateEmployees: true,
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: string, user: UserContext) {
        const gate = await this.gateRepository.findById(id, {
            devices: {
                include: {
                    _count: {
                        select: { actions: true },
                    },
                },
            },
            gateEmployees: {
                select: {
                    employeeId: true
                }
            },
            _count: {
                select: {
                    devices: true,
                    gateEmployees: true,
                },
            },
        });

        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        return gate;
    }

    async create(createGateDto: CreateGateDto, scope: DataScope) {

        const organizationId = createGateDto.organizationId ? createGateDto.organizationId : scope.organizationId

        const dto = { ...createGateDto, organizationId }
        return this.gateRepository.create(
            { ...dto, },
            {
                _count: {
                    select: {
                        devices: true,
                        gateEmployees: true,
                    },
                },
            },
            scope
        );
    }

    async update(id: string, updateGateDto: UpdateGateDto, user: UserContext) {
        await this.findOne(id, user);

        return this.gateRepository.update(id, updateGateDto, {
            _count: {
                select: {
                    devices: true,
                    gateEmployees: true,
                },
            },
        });
    }

    async remove(id: string, scope: DataScope, user: UserContext) {
        const gate = await this.gateRepository.findById(
            id,
            {
                _count: {
                    select: {
                        devices: true,
                        gateEmployees: true
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

    async getGateStatistics(id: string, user: UserContext) {
        const statistics = await this.gateRepository.getGateStatistics(id);

        if (!statistics) {
            throw new NotFoundException('Gate not found');
        }

        return statistics;
    }

    async getGateWithDevices(id: string, user: UserContext) {
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