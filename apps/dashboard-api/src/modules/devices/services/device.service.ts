import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreateDeviceDto, UpdateDeviceDto } from '../dto/device.dto';
import { UserContext } from '../../../shared/interfaces';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceType, EntryType, Prisma, WelcomeText } from '@prisma/client';
import { GateRepository } from '../../gate/repositories/gate.repository';
import { HikvisionService } from '../../hikvision/hikvision.service';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';

@Injectable()
export class DeviceService {
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly gateRepository: GateRepository,
        private hikvisionService: HikvisionService,
    ) { }

    async findAll(query: QueryDto & { type?: DeviceType; gateId?: number }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, type, gateId } = query;
        const where: Prisma.DeviceWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { ipAddress: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (type) {
            where.type = type;
        }

        if (gateId) {
            where.gateId = gateId;
        }

        return this.deviceRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                gate: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                _count: {
                    select: {
                        actions: true,
                    },
                },
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const device = await this.deviceRepository.findById(id, {
            gate: {
                select: {
                    id: true,
                    name: true,
                },
            },
            actions: {
                take: 10,
                orderBy: { actionTime: 'desc' },
                include: {
                    employee: { select: { id: true, name: true } },
                },
            },
            _count: { select: { actions: true } },
        });

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return device;
    }

    async create(createDeviceDto: CreateDeviceDto, scope: DataScope) {
        const { gateId, ipAddress, ...dtoData } = createDeviceDto;

        if (gateId && ipAddress) {
            const existing = await this.deviceRepository.findOneByGateAndIp(gateId, ipAddress);
            if (existing) {
                throw new BadRequestException('This gate already has a device with the same IP address');
            }
        }

        const hikvisionConfig: HikvisionConfig = {
            host: ipAddress,
            port: 80,
            username: dtoData.login,
            password: dtoData.password,
            protocol: 'http',
        };

        this.hikvisionService.setConfig(hikvisionConfig);

        const deviceInfoResult = await this.hikvisionService.getDeviceInfo(hikvisionConfig);
        if (!deviceInfoResult.success) {
            throw new BadRequestException(
                `Qurilmadan ma'lumot olishda xatolik: ${deviceInfoResult.message}`,
            );
        }

        const deviceInfo = deviceInfoResult.data;

        if (gateId) {
            const gate = await this.gateRepository.findById(gateId);
            if (!gate) {
                throw new NotFoundException('Gate not found');
            }
        }

        const device = {
            name: deviceInfo.deviceName || dtoData.name,
            manufacturer: deviceInfo.manufacturer || 'hikvision',
            model: deviceInfo.model || 'Unknown',
            firmware: deviceInfo.firmwareVersion || 'Unknown',
            serialNumber: deviceInfo.serialNumber || 'Unknown',
            ipAddress: ipAddress,
            login: dtoData.login,
            password: dtoData.password,
            type: dtoData.type,
            entryType: dtoData.entryType || EntryType.BOTH,
            welcomeText: dtoData.welcomeText || null,
            welcomeTextType: dtoData.welcomeTextType || null,
            welcomePhoto: dtoData.welcomePhoto || null,
            welcomePhotoType: dtoData.welcomePhotoType || null,
            isActive: dtoData.isActive !== undefined ? dtoData.isActive : true,
        }


        return this.deviceRepository.create(
            {
                ...device,
                ...(gateId && {
                    gate: {
                        connect: { id: gateId }
                    }
                })
            },
            {
                gate: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            scope
        );
    }


    async update(id: number, updateDeviceDto: UpdateDeviceDto, user: UserContext) {
        await this.findOne(id, user);

        const { gateId, ipAddress, ...dtoData } = updateDeviceDto;

        if (gateId && ipAddress) {
            const existing = await this.deviceRepository.findOneByGateAndIp(gateId, ipAddress);
            if (existing && existing.id !== id) {
                throw new BadRequestException('This gate already has a device with the same IP address');
            }
        }

        if (gateId) {
            const gate = await this.gateRepository.findById(gateId);
            if (!gate) {
                throw new NotFoundException('Gate not found');
            }
        }

        return this.deviceRepository.update(id,
            {
                ...dtoData,
                ...(updateDeviceDto.gateId !== undefined && {
                    gate: gateId
                        ? { connect: { id: gateId } }
                        : { disconnect: true }
                })
            },
            {
                gate: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            }
        );
    }


    async remove(id: number, scope: DataScope, user: UserContext) {
        const device = await this.deviceRepository.findById(
            id,
            {
                _count: {
                    select: {
                        actions: true,
                    },
                },
            },
            scope
        );

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        if ((device as any)._count?.actions > 0) {
            // Soft delete if has actions
            return this.deviceRepository.update(id, { isActive: false });
        }

        const result = await this.deviceRepository.delete(id, scope);
        return { message: 'Device deleted successfully', ...result  };
    }

    async testConnection(id: number, timeout: number = 5) {
        const device = await this.deviceRepository.findById(id);

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        try {
            // Simulate connection test (replace with actual HIKVision SDK call)
            const connectionResult = await this.performConnectionTest(device, timeout);

            // Update device status based on test result
            await this.deviceRepository.updateStatus(id, connectionResult.success);

            return {
                success: connectionResult.success,
                message: connectionResult.message,
                response_time: connectionResult.responseTime,
                tested_at: new Date(),
            };
        } catch (error) {
            await this.deviceRepository.updateStatus(id, false);
            throw new BadRequestException(`Connection test failed: ${error.message}`);
        }
    }

    private async performConnectionTest(device: any, timeout: number) {
        // Mock implementation - replace with actual HIKVision SDK
        return new Promise<{ success: boolean; message: string; responseTime: number }>(resolve => {
            setTimeout(() => {
                const success = Math.random() > 0.2; // 80% success rate for demo
                resolve({
                    success,
                    message: success ? 'Connection successful' : 'Connection failed',
                    responseTime: Math.floor(Math.random() * 1000) + 100,
                });
            }, Math.min(timeout * 1000, 2000));
        });
    }

    async findByType(type: DeviceType) {
        return this.deviceRepository.findByType(type);
    }

    async findOnlineDevices() {
        return this.deviceRepository.findOnlineDevices();
    }

    async updateDeviceStatus(id: number, isActive: boolean) {
        return this.deviceRepository.updateStatus(id, isActive);
    }

    async findByGate(gateId: number) {
        return this.deviceRepository.findMany(
            { gateId },
            { name: 'asc' },
            {
                _count: {
                    select: { actions: true },
                },
            }
        );
    }
}