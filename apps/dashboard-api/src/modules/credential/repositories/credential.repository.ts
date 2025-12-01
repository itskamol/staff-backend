import { Injectable } from '@nestjs/common';
import { Credential, Prisma } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

export type CredentialWithRelations = Credential & {
    employee?: {
        id: number;
        name: string;
    };
};

@Injectable()
export class CredentialRepository extends BaseRepository<
    CredentialWithRelations,
    Prisma.CredentialCreateInput,
    Prisma.CredentialUpdateInput,
    Prisma.CredentialWhereInput,
    Prisma.CredentialWhereUniqueInput,
    Prisma.CredentialOrderByWithRelationInput,
    Prisma.CredentialInclude
> {
    protected readonly modelName = 'Credential';

    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.credential;
    }

    getDefaultInclude(): Prisma.CredentialInclude {
        return {
            employee: {
                select: {
                    id: true,
                    name: true,
                },
            },
        };
    }

    async findByEmployeeId(
        employeeId: number,
        scope?: DataScope
    ): Promise<CredentialWithRelations[]> {
        return this.findMany(
            { employeeId },
            { createdAt: 'desc' },
            this.getDefaultInclude(),
            undefined,
            undefined,
            scope
        );
    }

    async findByCodeAndType(code: string, type: string): Promise<CredentialWithRelations | null> {
        return this.getDelegate().findFirst({
            where: { code, type: type as any, isActive: true },
            include: this.getDefaultInclude(),
        });
    }

    async deleteCredential(id: number, scope?: DataScope): Promise<Credential> {
        return this.softDelete(id, scope);
    }
}
