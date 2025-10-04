import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { OnetimeCode, Prisma, VisitorCodeType } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class OnetimeCodeRepository extends BaseRepository<
    OnetimeCode,
    Prisma.OnetimeCodeCreateInput,
    Prisma.OnetimeCodeUpdateInput,
    Prisma.OnetimeCodeWhereInput,
    Prisma.OnetimeCodeWhereUniqueInput,
    Prisma.OnetimeCodeOrderByWithRelationInput,
    Prisma.OnetimeCodeInclude,
    Prisma.OnetimeCodeSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.OnetimeCode;

    protected getDelegate() {
        return this.prisma.onetimeCode;
    }

    async findByCode(code: string) {
        return this.findFirst({ code });
    }

    async findByVisitorId(visitorId: number, include?: Prisma.OnetimeCodeInclude) {
        return this.findMany({ visitorId }, { createdAt: 'desc' }, include);
    }

    async findActiveCodes(include?: Prisma.OnetimeCodeInclude) {
        const now = new Date();
        return this.findMany({
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now }
        }, { createdAt: 'desc' }, include);
    }

    async findExpiredCodes(include?: Prisma.OnetimeCodeInclude) {
        const now = new Date();
        return this.findMany({
            OR: [
                { endDate: { lt: now } },
                { isActive: false }
            ]
        }, { createdAt: 'desc' }, include);
    }

    async findByCodeType(codeType: VisitorCodeType, include?: Prisma.OnetimeCodeInclude) {
        return this.findMany({ codeType }, { createdAt: 'desc' }, include);
    }

    async activateCode(id: number) {
        return this.update(id, { isActive: true });
    }

    async deactivateCode(id: number) {
        return this.update(id, { isActive: false });
    }

    async isCodeValid(code: string): Promise<boolean> {
        const now = new Date();
        const codeRecord = await this.findFirst({
            code,
            isActive: true,
            startDate: { lte: now },
            endDate: { gte: now }
        });

        return !!codeRecord;
    }

    async generateUniqueCode(): Promise<string> {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const code = `VIS${dateStr}${randomNum}`;

            const existing = await this.findByCode(code);
            if (!existing) {
                return code;
            }

            attempts++;
        }

        // Fallback with timestamp
        const timestamp = Date.now().toString().slice(-4);
        return `VIS${dateStr}${timestamp}`;
    }
}