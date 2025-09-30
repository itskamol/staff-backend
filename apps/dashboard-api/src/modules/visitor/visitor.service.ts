import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope, Role } from '@app/shared/auth';
import { QueryBuilderUtil, PaginationDto, EncryptionUtil, QueryDto } from '@app/shared/utils';
import { CreateVisitorDto, UpdateVisitorDto, GenerateCodeDto } from './dto/visitor.dto';
import { UserContext } from '../../shared/interfaces';
import { VisitorRepository } from './visitor.repository';
import { Prisma } from '@prisma/client';
// import * as QRCode from 'qrcode'; // TODO: Install qrcode package

@Injectable()
export class VisitorService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly visitorRepository: VisitorRepository
    ) {}

    async findAll(query: QueryDto, scope: DataScope, user: UserContext) {
        const where: Prisma.VisitorWhereInput = {};
        // Apply role-based filtering
        if (user.role === Role.HR) {
            where.creator = {
                organizationId: user.organizationId,
            };
        } else if (user.role === Role.DEPARTMENT_LEAD) {
            where.creator = {
                departmentUsers: {
                    some: {
                        departmentId: { in: user.departmentIds || [] },
                    },
                },
            };
        }

        const select = {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            birthday: true,
            phone: true,
            passportNumber: user.role === Role.GUARD ? false : true,
            pinfl: user.role === Role.GUARD ? false : true,
            workPlace: true,
            additionalDetails: user.role === Role.GUARD ? false : true,
            createdAt: true,
            creator: {
                select: {
                    id: true,
                    name: true,
                    organization: {
                        select: {
                            id: true,
                            fullName: true,
                            shortName: true,
                        },
                    },
                },
            },
            _count: {
                select: {
                    onetimeCodes: true,
                    actions: true,
                },
            },
        };

        return this.visitorRepository.findManyWithPagination(
            where,
            { createdAt: 'desc' },
            undefined,
            { page: query.page, limit: query.limit },
            scope,
            select
        );
    }

    async findOne(id: number, user: UserContext) {
        const visitor = await this.prisma.visitor.findUnique({
            where: { id },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                birthday: true,
                phone: true,
                passportNumber: user.role === Role.GUARD ? false : true,
                pinfl: user.role === Role.GUARD ? false : true,
                workPlace: true,
                additionalDetails: user.role === Role.GUARD ? false : true,
                createdAt: true,
                creator: {
                    select: {
                        id: true,
                        name: true,
                        organizationId: true,
                        organization: {
                            select: {
                                id: true,
                                fullName: true,
                                shortName: true,
                            },
                        },
                        departmentUsers: {
                            select: {
                                departmentId: true,
                            },
                        },
                    },
                },
                onetimeCodes:
                    user.role === Role.GUARD
                        ? false
                        : {
                              select: {
                                  id: true,
                                  codeType: true,
                                  code: true,
                                  startDate: true,
                                  endDate: true,
                                  isActive: true,
                              },
                          },
            },
        });

        if (!visitor) {
            throw new NotFoundException('Visitor not found');
        }

        // Check access permissions
        if (user.role === Role.HR && visitor.creator.organizationId !== user.organizationId) {
            throw new ForbiddenException('Access denied to this visitor');
        }

        if (user.role === Role.DEPARTMENT_LEAD) {
            const hasAccess = visitor.creator.departmentUsers.some(du =>
                user.departmentIds?.includes(du.departmentId)
            );
            if (!hasAccess) {
                throw new ForbiddenException('Access denied to this visitor');
            }
        }

        return visitor;
    }

    async create(createVisitorDto: CreateVisitorDto, user: UserContext) {
        const visitor = await this.prisma.visitor.create({
            data: {
                ...createVisitorDto,
                creator: { connect: { id: +user.sub } },
            },
        });

        return visitor;
    }

    async update(id: number, updateVisitorDto: UpdateVisitorDto, user: UserContext) {
        // Check if visitor exists and access permissions
        await this.findOne(id, user);

        const visitor = await this.prisma.visitor.update({
            where: { id },
            data: updateVisitorDto,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                birthday: true,
                phone: true,
                passportNumber: true,
                pinfl: true,
                workPlace: true,
                additionalDetails: true,
                createdAt: true,
            },
        });

        return visitor;
    }

    async remove(id: number, user: UserContext) {
        // Check if visitor exists and access permissions
        const visitor = await this.findOne(id, user);

        // Check if visitor has entry logs
        const actionsCount = await this.prisma.action.count({
            where: { visitorId: id },
        });

        if (actionsCount > 0) {
            throw new ForbiddenException('Cannot delete visitor with entry logs');
        }

        // Delete onetime codes first
        await this.prisma.onetimeCode.deleteMany({
            where: { visitorId: id },
        });

        // Delete visitor
        await this.prisma.visitor.delete({
            where: { id },
        });
    }

    async generateCode(id: number, generateCodeDto: GenerateCodeDto, user: UserContext) {
        // Check if visitor exists and access permissions
        const visitor = await this.findOne(id, user);

        const { codeType, startDate, endDate, additionalDetails } = generateCodeDto;

        // Generate unique code
        const code = EncryptionUtil.generateUUID().substring(0, 8).toUpperCase();

        const onetimeCode = await this.prisma.onetimeCode.create({
            data: {
                visitorId: id,
                codeType,
                code,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                additionalDetails,
            },
            select: {
                id: true,
                codeType: true,
                code: true,
                startDate: true,
                endDate: true,
                isActive: true,
                createdAt: true,
                visitor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
        });

        // Generate QR code data
        const qrData = {
            visitorId: id,
            codeId: onetimeCode.id,
            code: onetimeCode.code,
            visitorName: `${visitor.firstName} ${visitor.lastName}`,
            validFrom: onetimeCode.startDate,
            validTo: onetimeCode.endDate,
            codeType: onetimeCode.codeType,
        };

        // Generate QR code as base64 string
        const qrCodeBase64 = await this.generateQRCode(JSON.stringify(qrData));

        return {
            ...onetimeCode,
            qrCode: qrCodeBase64,
            qrData,
        };
    }

    private async generateQRCode(data: string): Promise<string> {
        try {
            // TODO: Implement actual QR code generation when qrcode package is installed
            // return await QRCode.toDataURL(data, {
            //   errorCorrectionLevel: 'M',
            //   type: 'image/png',
            //   quality: 0.92,
            //   margin: 1,
            //   color: {
            //     dark: '#000000',
            //     light: '#FFFFFF'
            //   }
            // });

            // Placeholder implementation - returns a mock base64 QR code
            return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
        } catch (error) {
            throw new Error(`Failed to generate QR code: ${error.message}`);
        }
    }

    async getEntryLogs(id: number, paginationDto: PaginationDto, user: UserContext) {
        // Check access permissions first
        await this.findOne(id, user);

        const query = QueryBuilderUtil.buildQuery(paginationDto);
        query.where.visitorId = id;

        const [actions, totalRecords] = await Promise.all([
            this.prisma.action.findMany({
                where: query.where,
                skip: query.skip,
                take: query.take,
                orderBy: { actionTime: 'desc' },
                select: {
                    id: true,
                    actionTime: true,
                    entryType: true,
                    actionType: true,
                    actionResult: true,
                    actionMode: true,
                    device: {
                        select: {
                            id: true,
                            name: true,
                            gate: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.action.count({ where: query.where }),
        ]);

        return QueryBuilderUtil.buildResponse(
            actions,
            totalRecords,
            paginationDto.page || 1,
            paginationDto.limit || 10
        );
    }

    async validateCode(code: string) {
        const onetimeCode = await this.prisma.onetimeCode.findFirst({
            where: {
                code,
                isActive: true,
                startDate: { lte: new Date() },
                endDate: { gte: new Date() },
            },
            select: {
                id: true,
                codeType: true,
                code: true,
                startDate: true,
                endDate: true,
                visitor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        middleName: true,
                        phone: true,
                        workPlace: true,
                    },
                },
            },
        });

        if (!onetimeCode) {
            throw new NotFoundException('Invalid or expired visitor code');
        }

        return onetimeCode;
    }

    async deactivateCode(codeId: number, user: UserContext) {
        // Check if code exists and user has access
        const onetimeCode = await this.prisma.onetimeCode.findUnique({
            where: { id: codeId },
            include: {
                visitor: {
                    include: {
                        creator: {
                            select: {
                                organizationId: true,
                                departmentUsers: {
                                    select: {
                                        departmentId: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!onetimeCode) {
            throw new NotFoundException('Visitor code not found');
        }

        // Check access permissions
        if (
            user.role === Role.HR &&
            onetimeCode.visitor.creator.organizationId !== user.organizationId
        ) {
            throw new ForbiddenException('Access denied to this visitor code');
        }

        if (user.role === Role.DEPARTMENT_LEAD) {
            const hasAccess = onetimeCode.visitor.creator.departmentUsers.some(du =>
                user.departmentIds?.includes(du.departmentId)
            );
            if (!hasAccess) {
                throw new ForbiddenException('Access denied to this visitor code');
            }
        }

        // Deactivate the code
        const updatedCode = await this.prisma.onetimeCode.update({
            where: { id: codeId },
            data: { isActive: false },
            select: {
                id: true,
                code: true,
                isActive: true,
            },
        });

        return updatedCode;
    }
}
