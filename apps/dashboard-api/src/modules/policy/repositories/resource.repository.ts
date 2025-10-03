import { PrismaService } from "@app/shared/database";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { BaseRepository } from "apps/dashboard-api/src/shared/repositories/base.repository";


@Injectable()
export class ResourceRepository extends BaseRepository<any, any, any, any, any, any, any, any> {
    constructor(protected readonly primsa: PrismaService) {
        super(primsa);
    }

    protected modelName: string = Prisma.ModelName.Resource;

    protected getDelegate() {
        return this.primsa.resource;
    }
}