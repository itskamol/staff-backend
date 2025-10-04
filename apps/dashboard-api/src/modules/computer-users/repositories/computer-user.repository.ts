import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { ComputerUser, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class ComputerUserRepository extends BaseRepository<
    ComputerUser,
    Prisma.ComputerUserCreateInput,
    Prisma.ComputerUserUpdateInput,
    Prisma.ComputerUserWhereInput,
    Prisma.ComputerUserWhereUniqueInput,
    Prisma.ComputerUserOrderByWithRelationInput,
    Prisma.ComputerUserInclude,
    Prisma.ComputerUserSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.ComputerUser;

    protected getDelegate() {
        return this.prisma.computerUser;
    }

    async findUnlinked(include?: Prisma.ComputerUserInclude) {
        return this.findMany({ employeeId: null }, undefined, include);
    }

    async findByEmployeeId(employeeId: number, include?: Prisma.ComputerUserInclude) {
        return this.findMany({ employeeId }, undefined, include);
    }

    async findByComputerId(computerId: number, include?: Prisma.ComputerUserInclude) {
        return this.findMany({ id: computerId }, undefined, include);
    }

    async findBySid(sidId: string) {
        return this.findFirst({ sid: sidId });
    }

    async linkEmployee(id: number, employeeId: number) {
        return this.update(id, { employee: { connect: { id: employeeId } } });
    }

    async unlinkEmployee(id: number) {
        return // Set employeeId to null to unlink;
    }
}
