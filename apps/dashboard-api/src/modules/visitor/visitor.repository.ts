import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../shared/repositories/base.repository';
import { PrismaService } from '@app/shared/database';
import { Prisma, Visitor } from '@prisma/client';

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
}
