import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import {
    CreateVisitorDto,
    UpdateVisitorDto,
    CreateOnetimeCodeDto,
    GenerateCodeDto,
} from '../dto/visitor.dto';
import { UserContext } from '../../../shared/interfaces';
import { VisitorRepository } from '../repositories/visitor.repository';
import { OnetimeCode, Prisma, Visitor, VisitorCodeType } from '@prisma/client';
import { OnetimeCodeRepository } from '../../onetime-codes/repositories/onetime-code.repository';

@Injectable()
export class VisitorService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly visitorRepository: VisitorRepository,
        private readonly codeRepository: OnetimeCodeRepository
    ) {}

    async findAll(query: QueryDto & { creatorId?: string }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, creatorId } = query;
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
            where.creatorId = parseInt(creatorId);
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
                _count: {
                    select: {
                        actions: true,
                        onetimeCodes: true,
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const visitor = await this.visitorRepository.findById(id, {
            creator: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                },
            },
            onetimeCodes: {
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
                    onetimeCodes: true,
                },
            },
        });

        if (!visitor) {
            throw new NotFoundException('Visitor not found');
        }

        return visitor;
    }

    async create(createVisitorDto: CreateVisitorDto, scope: DataScope) {
        // Verify creator exists
        const creator = await this.prisma.user.findUnique({
            where: { id: createVisitorDto.creatorId },
        });

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
                    connect: { id: createVisitorDto.creatorId },
                },
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
                        onetimeCodes: true,
                    },
                },
            },
            scope
        );

        if (!visitor) {
            throw new NotFoundException('Visitor not found');
        }

        if ((visitor as any)._count?.actions > 0) {
            // Soft delete if has actions
            return this.visitorRepository.update(id, { isActive: false });
        }

        return this.visitorRepository.delete(id, scope);
    }

    async generateCode(id: number, generateCodeDto: GenerateCodeDto, user: UserContext) {
        const visitor = await this.findOne(id, user);

        // Generate new code
        const code = await this.visitorRepository.generateOnetimeCode();

        const startDate = new Date();
        const endDate = new Date();
        endDate.setHours(endDate.getHours() + generateCodeDto.validityHours);

        // Create onetime code
        const onetimeCode = await this.prisma.onetimeCode.create({
            data: {
                visitorId: id,
                codeType: generateCodeDto.codeType,
                code,
                startDate,
                endDate,
                additionalDetails: generateCodeDto.additionalDetails,
                isActive: true,
            },
        });

        return {
            visitor: {
                id: visitor.id,
                firstName: visitor.firstName,
                lastName: visitor.lastName,
            },
            onetimeCode: {
                id: onetimeCode.id,
                code: onetimeCode.code,
                codeType: onetimeCode.codeType,
                startDate: onetimeCode.startDate,
                endDate: onetimeCode.endDate,
                validityHours: generateCodeDto.validityHours,
            },
        };
    }

    async findTodayVisitors() {
        return this.visitorRepository.findTodayVisitors();
    }

    async findWithActiveCodes() {
        return this.visitorRepository.findWithActiveCodes({
            creator: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                },
            },
            onetimeCodes: {
                where: {
                    isActive: true,
                    startDate: { lte: new Date() },
                    endDate: { gte: new Date() },
                },
            },
        });
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

    async validateCode(code: string) {
        const visitor = await this.visitorRepository.findByCode(code);

        if (!visitor) {
            throw new NotFoundException('Invalid or expired code');
        }

        const activeCode = await this.codeRepository.findFirst({ code, isActive: true });

        if (!activeCode) {
            throw new BadRequestException('Code is not active or expired');
        }

        return {
            visitor: {
                id: visitor.id,
                firstName: visitor.firstName,
                lastName: visitor.lastName,
                workPlace: visitor.workPlace,
            },
            code: {
                id: activeCode.id,
                code: activeCode.code,
                codeType: activeCode.codeType,
                validUntil: activeCode.endDate,
            },
        };
    }
}
