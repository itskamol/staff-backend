import { PrismaService } from '@app/shared/database';
import { Injectable } from '@nestjs/common';
import { Device, DeviceType, Prisma } from '@prisma/client';
import { BaseRepository } from 'apps/dashboard-api/src/shared/repositories/base.repository';

@Injectable()
export class DeviceRepository extends BaseRepository<
    Device,
    Prisma.DeviceCreateInput,
    Prisma.DeviceUpdateInput,
    Prisma.DeviceWhereInput,
    Prisma.DeviceWhereUniqueInput,
    Prisma.DeviceOrderByWithRelationInput,
    Prisma.DeviceInclude,
    Prisma.DeviceSelect
> {
    constructor(protected readonly prisma: PrismaService) {
        super(prisma);
    }

    protected readonly modelName = Prisma.ModelName.Device;

    protected getDelegate() {
        return this.prisma.device;
    }

    async findByIpAddress(ipAddress: string) {
        return this.findFirst({ ipAddress });
    }

    async findByType(type: DeviceType, include?: Prisma.DeviceInclude) {
        return this.findMany({ type }, undefined, include);
    }

    async findOnlineDevices() {
        return this.findMany({ isActive: true });
    }

    async updateStatus(id: number, isActive: boolean) {
        return this.update(id, { isActive });
    }

    async findWithActionCount(where?: Prisma.DeviceWhereInput) {
        return this.findMany(where, undefined, {
            _count: {
                select: {
                    actions: true,
                },
            },
        });
    }
}
