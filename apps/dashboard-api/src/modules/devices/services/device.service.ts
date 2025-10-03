import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { CreateDeviceDto, UpdateDeviceDto, DeviceType } from '../dto/device.dto';
import { UserContext } from '../../../shared/interfaces';
import { DeviceRepository } from '../repositories/device.repository';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeviceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly deviceRepository: DeviceRepository
    ) {}

    async findAll(query: QueryDto & { type?: string; status?: string }, scope: DataScope, user: UserContext) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, type, status } = query;
        const where: Prisma.DeviceWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { ip_address: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (type) {
            where.type = type as DeviceType;
        }

        if (status) {
            where.status = status;
        }

        return this.deviceRepository.findManyWithPagination(
            where,
            { [sort]: order },
            {
                _count: {
                    select: {
                        actions: true
                    }
                }
            },
            { page, limit },
            scope
        );
    }

    async findOne(id: number, user: UserContext) {
        const device = await this.deviceRepository.findById(id, {
            actions: {
                take: 10,
                orderBy: { action_time: 'desc' },
                include: {
                    entryLogs: {
                        include: {
                            employee: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            },
            _count: {
                select: {
                    actions: true
                }
            }
        });

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return device;
    }

    async create(createDeviceDto: CreateDeviceDto, scope: DataScope) {
        // Check if device with same IP already exists
        const existing = await this.deviceRepository.findByIpAddress(createDeviceDto.ip_address);
        if (existing) {
            throw new BadRequestException('Device with this IP address already exists');
        }

        return this.deviceRepository.create({
            ...createDeviceDto,
            status: 'offline',
            last_ping: new Date()
        }, undefined, scope);
    }

    async update(id: number, updateDeviceDto: UpdateDeviceDto, user: UserContext) {
        await this.findOne(id, user);

        // Check if updating to existing IP
        if (updateDeviceDto.ip_address) {
            const existing = await this.deviceRepository.findByIpAddress(updateDeviceDto.ip_address);
            if (existing && existing.id !== id) {
                throw new BadRequestException('Device with this IP address already exists');
            }
        }

        return this.deviceRepository.update(id, updateDeviceDto);
    }

    async remove(id: number, scope: DataScope, user: UserContext) {
        const device = await this.deviceRepository.findById(id, {
            _count: {
                select: {
                    actions: true
                }
            }
        }, scope);

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        if ((device as any)._count?.actions > 0) {
            // Soft delete if has actions
            return this.deviceRepository.update(id, { is_active: false });
        }

        return this.deviceRepository.delete(id, scope);
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
            await this.deviceRepository.updateStatus(
                id, 
                connectionResult.success ? 'online' : 'offline',
                new Date()
            );

            return {
                success: connectionResult.success,
                message: connectionResult.message,
                response_time: connectionResult.responseTime,
                tested_at: new Date()
            };
        } catch (error) {
            await this.deviceRepository.updateStatus(id, 'error', new Date());
            throw new BadRequestException(`Connection test failed: ${error.message}`);
        }
    }

    private async performConnectionTest(device: any, timeout: number) {
        // Mock implementation - replace with actual HIKVision SDK
        return new Promise<{ success: boolean; message: string; responseTime: number }>((resolve) => {
            setTimeout(() => {
                const success = Math.random() > 0.2; // 80% success rate for demo
                resolve({
                    success,
                    message: success ? 'Connection successful' : 'Connection failed',
                    responseTime: Math.floor(Math.random() * 1000) + 100
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

    async updateDeviceStatus(id: number, status: string) {
        return this.deviceRepository.updateStatus(id, status, new Date());
    }
}