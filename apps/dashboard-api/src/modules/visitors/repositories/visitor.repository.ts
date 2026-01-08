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
}
