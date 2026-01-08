import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import {
    CreateOnetimeCodeDto,
    QueryOnetimeCodeDto,
    UpdateOnetimeCodeDto,
} from '../dto/onetime-code.dto';
import { UserContext } from '../../../shared/interfaces';
import { OnetimeCodeRepository } from '../repositories/onetime-code.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class OnetimeCodeService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly onetimeCodeRepository: OnetimeCodeRepository
    ) {}

    async findAll(query: QueryOnetimeCodeDto, scope: DataScope, user: UserContext) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            visitorId,
            codeType,
            isActive,
        } = query;
        const where: Prisma.OnetimeCodeWhereInput = {};

        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { visitor: { firstName: { contains: search, mode: 'insensitive' } } },
                { visitor: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (visitorId) {
            where.visitorId = visitorId;
        }

        if (codeType) {
            where.codeType = codeType;
        }

        if (typeof isActive === 'boolean') {
            where.isActive = isActive;
        }

        return this.onetimeCodeRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                visitor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        workPlace: true,
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const onetimeCode = await this.onetimeCodeRepository.findById(id, {
            visitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    middleName: true,
                    workPlace: true,
                    phone: true,
                    creator: {
                        select: {
                            id: true,
                            name: true,
                            username: true,
                        },
                    },
                },
            },
        });

        if (!onetimeCode) {
            throw new NotFoundException('Onetime code not found');
        }

        return onetimeCode;
    }

    async create(createOnetimeCodeDto: CreateOnetimeCodeDto, scope: DataScope) {
        const visitor = await this.prisma.visitor.findUnique({
            where: { id: createOnetimeCodeDto.visitorId },
        });

        if (!visitor) {
            throw new NotFoundException('Visitor not found');
        }

        const code = await this.onetimeCodeRepository.generateUniqueCode();

        return this.onetimeCodeRepository.create(
            {
                code,
                codeType: createOnetimeCodeDto.codeType,
                startDate: new Date(createOnetimeCodeDto.startDate),
                endDate: new Date(createOnetimeCodeDto.endDate),
                additionalDetails: createOnetimeCodeDto.additionalDetails,
                isActive: createOnetimeCodeDto.isActive,
                organization: {
                    connect: { id: scope?.organizationId || visitor.organizationId },
                },
                visitor: {
                    connect: { id: createOnetimeCodeDto.visitorId },
                },
            },
            undefined,
            scope
        );
    }

    async update(id: number, updateOnetimeCodeDto: UpdateOnetimeCodeDto, user: UserContext) {
        await this.findOne(id, user);

        const updateData: any = { ...updateOnetimeCodeDto };

        if (updateOnetimeCodeDto.startDate) {
            updateData.startDate = new Date(updateOnetimeCodeDto.startDate);
        }

        if (updateOnetimeCodeDto.endDate) {
            updateData.endDate = new Date(updateOnetimeCodeDto.endDate);
        }

        return this.onetimeCodeRepository.update(id, updateData);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const onetimeCode = await this.onetimeCodeRepository.findById(id, undefined, scope);

        if (!onetimeCode) {
            throw new NotFoundException('Onetime code not found');
        }

        return this.onetimeCodeRepository.softDelete(id, scope);
    }

    async activate(id: number, user: UserContext) {
        await this.findOne(id, user);
        return this.onetimeCodeRepository.activateCode(id);
    }

    async deactivate(id: number, user: UserContext) {
        await this.findOne(id, user);
        return this.onetimeCodeRepository.deactivateCode(id);
    }

    async findByVisitorId(visitorId: number) {
        return this.onetimeCodeRepository.findByVisitorId(visitorId, {
            visitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                },
            },
        });
    }

    async findActiveCodes() {
        return this.onetimeCodeRepository.findActiveCodes({
            visitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    workPlace: true,
                },
            },
        });
    }

    async findExpiredCodes() {
        return this.onetimeCodeRepository.findExpiredCodes({
            visitor: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    workPlace: true,
                },
            },
        });
    }

    async validateCode(code: string) {
        const isValid = await this.onetimeCodeRepository.isCodeValid(code);

        if (!isValid) {
            throw new BadRequestException('Invalid or expired code');
        }

        const codeRecord = await this.onetimeCodeRepository.findByCode(code);

        return {
            valid: true,
            code: {
                id: codeRecord.id,
                code: codeRecord.code,
                codeType: codeRecord.codeType,
                startDate: codeRecord.startDate,
                endDate: codeRecord.endDate,
            },
            visitor: {
                id: codeRecord.visitorId,
            },
        };
    }
}
