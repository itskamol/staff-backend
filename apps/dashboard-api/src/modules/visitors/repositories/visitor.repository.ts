import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Visitor, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class VisitorRepository extends BaseRepository<
    Visitor,
    Prisma.VisitorCreateInput,
    Prisma.VisitorUpdateInput,
    Prisma.VisitorWhereInput,
    Prisma.VisitorWhereUniqueInput,
    Prisma.VisitorOrderByWithRelationInput,
    Prisma.VisitorInclude,
    Prisma.VisitorSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Visitor;

    protected getDelegate() {
        return this.prisma.visitor;
    }

    async findByCode(code: string) {
        return this.findFirst(
            {
                onetimeCodes: {
                    some: {
                        code,
                        isActive: true,
                    },
                },
            },
            undefined,
            { onetimeCodes: true }
        );
    }

    async findByPhone(phone: string) {
        return this.findFirst({ phone });
    }

    async findByPassportNumber(passportNumber: string) {
        return this.findFirst({ passportNumber });
    }

    async findByPinfl(pinfl: string) {
        return this.findFirst({ pinfl });
    }

    async findByCreator(creatorId: number, include?: Prisma.VisitorInclude) {
        return this.findMany({ creatorId }, undefined, include);
    }

    async findTodayVisitors() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.findMany({
            createdAt: {
                gte: today,
                lt: tomorrow,
            },
        });
    }

    async findWithActiveCodes(include?: Prisma.VisitorInclude) {
        return this.findMany(
            {
                onetimeCodes: {
                    some: {
                        isActive: true,
                        startDate: { lte: new Date() },
                        endDate: { gte: new Date() },
                    },
                },
            },
            undefined,
            include
        );
    }

    async findWithActionCount(where?: Prisma.VisitorWhereInput) {
        return this.findMany(where, undefined, {
            _count: {
                select: {
                    actions: true,
                    onetimeCodes: true,
                },
            },
        });
    }

    async generateUniqueCode(): Promise<string> {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const randomNum = Math.floor(Math.random() * 10000)
                .toString()
                .padStart(4, '0');
            const code = `VIS${dateStr}${randomNum}`;

            const existing = await this.findByOnetimeCode(code);
            if (!existing) {
                return code;
            }

            attempts++;
        }

        // Fallback with timestamp
        const timestamp = Date.now().toString().slice(-4);
        return `VIS${dateStr}${timestamp}`;
    }

    private async findByOnetimeCode(code: string) {
        return this.prisma.onetimeCode.findFirst({
            where: { code, deletedAt: null, isActive: true },
            select: {
                visitor: true,
            },
        });
    }
}
