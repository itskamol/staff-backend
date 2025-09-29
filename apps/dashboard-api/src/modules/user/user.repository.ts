import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { BaseRepository } from '../../shared/repositories/base.repository';
import { PrismaService } from '@app/shared/database';

@Injectable()
export class UserRepository extends BaseRepository<
    User,
    Prisma.UserCreateInput,
    Prisma.UserUpdateInput,
    Prisma.UserWhereInput,
    Prisma.UserWhereUniqueInput,
    Prisma.UserOrderByWithRelationInput,
    Prisma.UserInclude,
    Prisma.UserSelect
> {
    protected readonly modelName = Prisma.ModelName.User;

    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected getDelegate() {
        return this.prisma.user;
    }
}
