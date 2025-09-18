import { PrismaService } from '@/core/database/prisma.service';
import { BaseRepository } from '@/shared/repositories/base.repository';
import { Injectable } from '@nestjs/common';
import { Organization, Prisma } from '@prisma/client';

@Injectable()
export class OrganizationRepository extends BaseRepository<
    Organization,
    Prisma.OrganizationCreateInput,
    Prisma.OrganizationUpdateInput,
    Prisma.OrganizationWhereInput,
    Prisma.OrganizationWhereUniqueInput,
    Prisma.OrganizationOrderByWithRelationInput,
    Prisma.OrganizationInclude
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Organization;
    
    protected getDelegate() {
        return this.prisma.organization;
    }
}
