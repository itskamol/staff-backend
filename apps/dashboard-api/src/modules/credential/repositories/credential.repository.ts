import { Injectable } from '@nestjs/common';
import { Action, ActionType, Credential, Prisma } from '@prisma/client';
import { PrismaService } from '@app/shared/database';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

export type CredentialWithRelations = Credential & {
    employee?: {
        id: number;
        name: string;
    }
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

    constructor(prisma: PrismaService) {
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
                }
            }
        };
    }
    
   
    async findByEmployeeId(employeeId: number): Promise<CredentialWithRelations[]> {
        return await this.findMany(
            { employeeId },
            { createdAt: 'desc' },
            this.getDefaultInclude()
        );
    }
    

    async findByCodeAndType(code: string, type: string): Promise<CredentialWithRelations | null> {
        return await this.getDelegate().findFirst({
            where: {
                code,
                type: type as ActionType,
                isActive: true
            },
            include: this.getDefaultInclude()
        });
    }

   
    async deleteCredential(id: number): Promise<Credential> {
        return await this.delete(id);
    }
}
