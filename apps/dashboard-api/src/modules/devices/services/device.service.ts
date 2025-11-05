import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { AssignEmployeesToGatesDto, CreateDeviceDto, UpdateDeviceDto } from '../dto/device.dto';
import { UserContext } from '../../../shared/interfaces';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceType, EntryType, Prisma, WelcomeText } from '@prisma/client';
import { GateRepository } from '../../gate/repositories/gate.repository';
import { HikvisionService } from '../../hikvision/hikvision.service';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { PrismaService } from '@app/shared/database';
import { Server } from 'socket.io';
import { StatusEnum } from '@prisma/client';
import { EventsGateway } from '../../websocket/events.gateway';
import { EmployeeRepository } from '../../employee/repositories/employee.repository';


@Injectable()
export class DeviceService {
    private socket: Server
    constructor(
        private readonly deviceRepository: DeviceRepository,
        private readonly gateRepository: GateRepository,
        private hikvisionService: HikvisionService,
        private readonly prisma: PrismaService,
        private readonly gateway: EventsGateway,
        private readonly employeeSyncRepository: EmployeeRepository
    ) {
        this.socket = this.gateway.server;
    }

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

        const capResponse = await this.hikvisionService.getDeviceCapabilities(hikvisionConfig);
        if (!capResponse) {
            throw new BadRequestException('Qurilma capabilities ni olishda xatolik');
        }

        // 3. FACE QO‘LLAB-QUVVATLANADIMI?
        const rawCap = capResponse; // Bu JSON yoki XML parsed object
        const isSupportFace = Boolean(
            rawCap?.DeviceCap?.isSupportFace ||                    // Umumiy cap
            rawCap?.CapAccessControl?.isSupportFace ||             // Access Control cap
            rawCap?.FaceLibCap?.maxFDNum > 0 ||                    // Face library bor
            rawCap?.DeviceCap?.isSupportAlgorithmsInfo === true   // Algoritm bor
        );

        // 4. JSONB uchun tayyor object
        const capabilities = {
            isSupportFace
        };

        console.log('FACE SUPPORT:', isSupportFace ? 'YES ✅' : 'NO ❌');
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
            capabilities
        }


        const newDevice = await this.deviceRepository.create(
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

        await this.hikvisionService.configureEventListeningHost(hikvisionConfig, newDevice.id)

        return newDevice
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
        return { message: 'Device deleted successfully', ...result };
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


    setSocketServer(socket: Server) {
        this.socket = socket;
    }

    async assignEmployeesToGates(
        dto: AssignEmployeesToGatesDto,
        scope: DataScope,
        user: UserContext) {
        const { gateIds, employeeIds } = dto;
        const result = {
            total: 0,
            success: 0
        };

        let organizationId = user?.organizationId 
        if(!organizationId && user.role != "ADMIN"){
          throw new NotFoundException('User organizationId not found!')
        }

        // 1. Gates
        const gates = await this.prisma.gate.findMany({
            where: { id: { in: gateIds } },
            include: { devices: true },
        });
        if (!gates.length) throw new Error('Gate topilmadi');

        // 2. Credentials
        const credentials = await this.prisma.credential.findMany({
            where: { employeeId: { in: employeeIds }, type: 'PHOTO', isActive: true },
            select: { employeeId: true },
        });
        const credMap = new Map(credentials.map(c => [c.employeeId, true]));

        // 3. MAIN LOOP
        for (const gate of gates) {
            if (!gate.devices?.length) {
                this.gateway.server.emit('sync', {
                    syncId: null,
                    employee: null,
                    gate: { id: gate.id, name: gate.name },
                    device: null,
                    status: 'ERROR',
                    message: 'Ushbu gate uchun device topilmadi',
                    step: 'DEVICE_CHECK',
                    timestamp: new Date().toISOString(),
                });
                continue;
            }

            for (const device of gate.devices) {
                const caps = (device.capabilities as any) || {};

                if (!caps.isSupportFace) {
                    this.gateway.server.emit('sync', {
                        syncId: null,
                        employee: null,
                        gate: { id: gate.id, name: gate.name },
                        device: { id: device.id, name: device.name || device.ipAddress, ip: device.ipAddress },
                        status: 'SKIPPED',
                        message: 'Face qo‘llab-quvvatlanmaydi',
                        step: 'DEVICE_CHECK',
                        timestamp: new Date().toISOString(),
                    });
                    continue;
                }

                for (const empId of employeeIds) {
                    const employee = await this.prisma.employee.findUnique({
                        where: { id: empId },
                        select: { photo: true, name: true },
                    });

                    const sync = await this.prisma.employeeSync.create({
                        data: {
                            employeeId: empId,
                            deviceId: device.id,
                            gateId: gate.id,
                            organizationId,
                            status: 'INP',
                        },
                    });


                    const emitBase = {
                        syncId: sync.id,
                        employee: { id: empId, name: employee?.name || 'Noma’lum' },
                        gate: { id: gate.id, name: gate.name },
                        device: { id: device.id, name: device.name || device.ipAddress, ip: device.ipAddress },
                        timestamp: new Date().toISOString(),
                    };

                    this.gateway.server.emit('sync', { ...emitBase, status: 'IN_PROGRESS', message: 'Boshlandi', step: 'VALIDATION' });

                    try {
                        if (!credMap.has(empId)) {
                            throw new Error('Photo credential topilmadi');
                        }

                        await this.hikvisionService.createUser(
                            {
                                employeeId: empId.toString(),
                                userType: 'normal',
                                beginTime: '2025-01-01T00:00:00',
                                endTime: '2035-12-31T23:59:59',
                            },
                            {
                                host: device.ipAddress,
                                port: 80,
                                protocol: 'http',
                                username: device.login,
                                password: device.password,
                            },
                        );
                        await this.updateSync(sync.id, 'PROGRESS', 'User yaratildi');
                        this.gateway.server.emit('sync', { ...emitBase, status: 'IN_PROGRESS', message: 'User yaratildi', step: 'USER_CREATION' });

                        if (!employee?.photo) throw new Error('Foto topilmadi');

                        const photoUrl = `http://192.168.100.82:3001/storage/${employee.photo}`;
                        await this.hikvisionService.addFaceToUserViaURL(
                            empId.toString(),
                            photoUrl,
                            {
                                host: device.ipAddress,
                                port: 80,
                                protocol: 'http',
                                username: device.login,
                                password: device.password,
                            },
                        );

                        await this.updateSync(sync.id, 'DONE', 'Muvaffaqiyatli!');
                        result.success++;
                        this.gateway.server.emit('sync', { ...emitBase, status: 'DONE', message: 'Face muvaffaqiyatli qo‘shildi', step: 'ADD_FACE' });

                    } catch (err: any) {
                        const msg = err?.message || 'Noma’lum xato';
                        await this.updateSync(sync.id, 'ERROR', msg);
                        this.gateway.server.emit('sync', { ...emitBase, status: 'ERROR', message: msg, step: 'VALIDATION', error: msg });
                    }
                }
            }
        }

        result.total = result.success;
        return { success: true };

    }


    private async updateSync(id: number, status: StatusEnum, message?: string) {
        const updated = await this.prisma.employeeSync.update({
            where: { id },
            data: { status, message, updatedAt: new Date() },
        });

        this.gateway.server.emit('sync', {
            syncId: id,
            status,
            message: message || status,
            updatedAt: updated.updatedAt,
        });
    }


    testSocket() {
        this.gateway.server.emit('sync', {
            syncId: 999,
            status: 'DONE',
            message: 'BACKEND TEST — SOCKET 100% ISHLAYDI! 🚀 yessss',
            gateId: 1,
            deviceId: 1,
            employeeId: 999,
            updatedAt: new Date().toISOString()
        });

        return { success: true, message: 'Test emit yuborildi!' };
    }

}