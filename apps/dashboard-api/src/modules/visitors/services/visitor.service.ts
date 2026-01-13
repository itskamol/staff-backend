import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope, UserContext } from '@app/shared/auth';
import { CreateVisitorDto, QueryVisitorDto, UpdateVisitorDto } from '../dto/visitor.dto';
import { VisitorRepository } from '../repositories/visitor.repository';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class VisitorService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly visitorRepository: VisitorRepository,
        @InjectQueue(JOB.VISITOR.NAME) private readonly visitorQueue: Queue
    ) {}

    async findAll(query: QueryVisitorDto, scope: DataScope, user: UserContext) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            creatorId,
            attachedId,
        } = query;
        const where: Prisma.VisitorWhereInput = {};

        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { passportNumber: { contains: search, mode: 'insensitive' } },
                { pinfl: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (creatorId) {
            where.creatorId = creatorId;
        }

        if (attachedId) {
            where.attachedId = attachedId;
        }

        return this.visitorRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                creator: {
                    select: {
                        id: true,
                        name: true,
                        username: true,
                    },
                },
                onetimeCodes: {
                    where: { isActive: true },
                    select: {
                        id: true,
                        code: true,
                        codeType: true,
                        startDate: true,
                        endDate: true,
                        isActive: true,
                    },
                },
                attached: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        actions: true,
                        onetimeCodes: { where: { isActive: true, deletedAt: null } },
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, scope: DataScope) {
        const visitor = await this.visitorRepository.findById(id, {
            creator: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                },
            },
            onetimeCodes: {
                where: { isActive: true, deletedAt: null },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    code: true,
                    codeType: true,
                    startDate: true,
                    endDate: true,
                    additionalDetails: true,
                    isActive: true,
                    createdAt: true,
                },
            },
            attached: {
                select: {
                    id: true,
                    name: true,
                },
            },
            actions: {
                take: 10,
                orderBy: { actionTime: 'desc' },
                include: {
                    device: {
                        select: {
                            name: true,
                            ipAddress: true,
                        },
                    },
                    gate: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    actions: true,
                    onetimeCodes: { where: { isActive: true, deletedAt: null } },
                },
            },
        });

        if (!visitor) {
            throw new NotFoundException('Visitor not found');
        }

        return visitor;
    }

    async create(createVisitorDto: CreateVisitorDto, scope: DataScope, user: UserContext) {
        // Verify creator exists
        const creator = await this.prisma.user.findUnique({
            where: { id: +user.sub },
        });

        const { gateId } = createVisitorDto;

        if (!creator) {
            throw new NotFoundException('Creator user not found');
        }

        // Check for duplicate passport or PINFL
        if (createVisitorDto.passportNumber) {
            const existingByPassport = await this.visitorRepository.findByPassportNumber(
                createVisitorDto.passportNumber
            );
            if (existingByPassport) {
                throw new BadRequestException('Visitor with this passport number already exists');
            }
        }

        if (createVisitorDto.pinfl) {
            const existingByPinfl = await this.visitorRepository.findByPinfl(
                createVisitorDto.pinfl
            );
            if (existingByPinfl) {
                throw new BadRequestException('Visitor with this PINFL already exists');
            }
        }

        return this.visitorRepository.create(
            {
                firstName: createVisitorDto.firstName,
                lastName: createVisitorDto.lastName,
                middleName: createVisitorDto.middleName,
                birthday: createVisitorDto.birthday,
                phone: createVisitorDto.phone,
                passportNumber: createVisitorDto.passportNumber,
                pinfl: createVisitorDto.pinfl,
                workPlace: createVisitorDto.workPlace,
                additionalDetails: createVisitorDto.additionalDetails,
                isActive: createVisitorDto.isActive,
                creator: {
                    connect: { id: +user.sub },
                },
                organization: {
                    connect: { id: scope?.organizationId || createVisitorDto?.organizationId },
                },
                attached: createVisitorDto.attachedId
                    ? {
                          connect: { id: createVisitorDto.attachedId },
                      }
                    : undefined,
                gate: gateId
                    ? {
                          connect: { id: gateId },
                      }
                    : undefined,
            },
            undefined,
            scope
        );
    }

    async update(id: number, updateVisitorDto: UpdateVisitorDto, user: UserContext) {
        await this.findOne(id, user);

        // Check for duplicate passport or PINFL if updating
        if (updateVisitorDto.passportNumber) {
            const existing = await this.visitorRepository.findByPassportNumber(
                updateVisitorDto.passportNumber
            );
            if (existing && existing.id !== id) {
                throw new BadRequestException('Visitor with this passport number already exists');
            }
        }

        if (updateVisitorDto.pinfl) {
            const existing = await this.visitorRepository.findByPinfl(updateVisitorDto.pinfl);
            if (existing && existing.id !== id) {
                throw new BadRequestException('Visitor with this PINFL already exists');
            }
        }

        return this.visitorRepository.update(id, updateVisitorDto);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const visitor = await this.visitorRepository.findById(
            id,
            {
                _count: {
                    select: {
                        actions: true,
                        onetimeCodes: { where: { deletedAt: null, isActive: true } },
                    },
                },
            },
            scope
        );

        if (!visitor) {
            throw new NotFoundException('Visitor not found');
        }

        await this.visitorQueue.add(JOB.VISITOR.REMOVE_VISITOR_FROM_ALL_DEVICES, {
            visitorId: id,
        });

        if ((visitor as any)._count?.actions > 0) {
            // Soft delete if has actions
            return this.visitorRepository.update(id, { isActive: false });
        }

        return this.visitorRepository.softDelete(id, scope);
    }

    async findTodayVisitors() {
        return this.visitorRepository.findTodayVisitors();
    }

    async findByCreator(creatorId: number) {
        return this.visitorRepository.findByCreator(creatorId, {
            _count: {
                select: {
                    actions: true,
                    onetimeCodes: true,
                },
            },
        });
    }

    async findByAttachedUser(attachedId: number) {
        return this.visitorRepository.findFirst({ attachedId }, undefined, {
            _count: {
                select: {
                    actions: true,
                    onetimeCodes: true,
                },
            },
        });
    }

    async getActions(id: number, user: UserContext) {
        const visitor = await this.findOne(id, user);

        const actions = await this.prisma.action.findMany({
            where: { visitorId: id },
            include: {
                device: {
                    select: {
                        name: true,
                        ipAddress: true,
                        entryType: true,
                    },
                },
                gate: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { actionTime: 'desc' },
        });

        return {
            visitor: {
                id: visitor.id,
                firstName: visitor.firstName,
                lastName: visitor.lastName,
            },
            actions,
        };
    }
}
