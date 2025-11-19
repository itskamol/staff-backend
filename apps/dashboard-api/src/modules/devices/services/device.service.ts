import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { AssignEmployeesToGatesDto, CreateDeviceDto, UpdateDeviceDto } from '../dto/device.dto';
import { UserContext } from '../../../shared/interfaces';
import { DeviceRepository } from '../repositories/device.repository';
import { DeviceType, EntryType, Prisma } from '@prisma/client';
import { GateRepository } from '../../gate/repositories/gate.repository';
import { HikvisionService } from '../../hikvision/hikvision.service';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { PrismaService } from '@app/shared/database';
import { Server } from 'socket.io';
import { StatusEnum } from '@prisma/client';
import { EventsGateway } from '../../websocket/events.gateway';
import { ConfigService } from 'apps/dashboard-api/src/core/config/config.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { EncryptionService } from 'apps/dashboard-api/src/shared/services/encryption.service';
import { GateDto } from '../../gate/dto/gate.dto';

@Injectable()
export class DeviceService {
    private socket: Server;
    constructor(
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue,
        private readonly deviceRepository: DeviceRepository,
        private readonly gateRepository: GateRepository,
        private hikvisionService: HikvisionService,
        private readonly prisma: PrismaService,
        private readonly gateway: EventsGateway,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService
    ) {
        this.socket = this.gateway.server;
    }

    async configCheck() {
        const port = this.configService.port;
        const ip = this.configService.hostIp;
        return { port, ip };
    }

    async findAll(
        query: QueryDto & { type?: DeviceType; gateId?: number; organizationId?: number },
        scope: DataScope,
        user: UserContext
    ) {
        const { page, limit, sort = 'createdAt', order = 'desc', search, type, gateId } = query;
        const where: Prisma.DeviceWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { ipAddress: { contains: search, mode: 'insensitive' } },
            ];
        }

        // if(scope?.organizationId){
        //     console.log(scope?.organizationId)
        //     where.gate.organizationId = scope?.organizationId
        // }

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

    async findOne(id: number, scope: DataScope) {
        const device = await this.deviceRepository.findById(
            id,
            {
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
            },
            scope
        );

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        return device;
    }

    async create(createDeviceDto: CreateDeviceDto, scope: DataScope) {
        const { gateId, ipAddress, ...dtoData } = createDeviceDto;

        dtoData.password = this.encryptionService.encrypt(dtoData.password);

        if (gateId && ipAddress) {
            const existing = await this.deviceRepository.findOneByGateAndIp(gateId, ipAddress);
            if (existing) {
                throw new BadRequestException(
                    'This gate already has a device with the same IP address'
                );
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
                `Qurilmadan ma'lumot olishda xatolik: ${deviceInfoResult.message}`
            );
        }

        const capResponse = await this.hikvisionService.getDeviceCapabilities(hikvisionConfig);
        if (!capResponse) {
            throw new BadRequestException('Qurilma capabilities ni olishda xatolik');
        }

        const rawCap = capResponse;
        const isSupportFace = Boolean(
            rawCap?.DeviceCap?.isSupportFace ||
                rawCap?.CapAccessControl?.isSupportFace ||
                rawCap?.FaceLibCap?.maxFDNum > 0 ||
                rawCap?.DeviceCap?.isSupportAlgorithmsInfo === true
        );

        const capabilities = {
            isSupportFace,
        };

        const deviceInfo = deviceInfoResult.data;

        let gate: GateDto;

        if (gateId) {
            gate = await this.gateRepository.findById(gateId);
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
            capabilities,
        };

        const newDevice = await this.deviceRepository.create(
            {
                ...device,
                ...(gateId && {
                    gate: {
                        connect: { id: gateId },
                    },
                }),
                ...(gate && {
                    organization: {
                        connect: { id: gate.organizationId },
                    },
                }),
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

        const job = await this.deviceQueue.add(JOB.DEVICE.CREATE, {
            hikvisionConfig,
            newDeviceId: newDevice.id,
            gateId,
            scope,
        });

        return newDevice;
    }

    async update(id: number, updateDeviceDto: UpdateDeviceDto, scope: DataScope) {
        await this.findOne(id, scope);

        const { gateId, ipAddress, ...dtoData } = updateDeviceDto;

        if (gateId && ipAddress) {
            const existing = await this.deviceRepository.findOneByGateAndIp(gateId, ipAddress);
            if (existing && existing.id !== id) {
                throw new BadRequestException(
                    'This gate already has a device with the same IP address'
                );
            }
        }

        if (gateId) {
            const gate = await this.gateRepository.findById(gateId, {}, scope);
            if (!gate) {
                throw new NotFoundException('Gate not found');
            }
        }

        return this.deviceRepository.update(
            id,
            {
                ...dtoData,
                ...(updateDeviceDto.gateId !== undefined && {
                    gate: gateId ? { connect: { id: gateId } } : { disconnect: true },
                }),
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

        const config: HikvisionConfig = {
            host: device.ipAddress,
            port: 80,
            username: device.login,
            password: device.password,
            protocol: device.protocol || 'http',
        };

        const job = await this.deviceQueue.add(JOB.DEVICE.DELETE, { device, config });

        const result = await this.deviceRepository.delete(id, scope);
        return { message: 'Device deleted successfully', ...result };
    }

    async testConnection(id: number, timeout: number = 5) {
        const device = await this.deviceRepository.findById(id);

        if (!device) {
            throw new NotFoundException('Device not found');
        }

        try {
            const connectionResult = await this.performConnectionTest(device, timeout);

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
        user?: UserContext
    ) {
        const { gateIds, employeeIds } = dto;
        const result = {
            total: 0,
            success: 0,
        };

        const organizationId = dto.organizationId ? dto.organizationId : scope.organizationId;

        const port = this.configService.port;
        const ip = this.configService.hostIp;

        const gates = await this.prisma.gate.findMany({
            where: { id: { in: gateIds } },
            include: { devices: true },
        });
        if (!gates.length) throw new Error('Gate not found!');

        const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
        });
        if (!employees.length) throw new Error('Employees not found!');

        const createData = [];

        for (const gate of gates) {
            for (const employee of employees) {
                createData.push({
                    employeeId: +employee.id,
                    gateId: +gate.id,
                });
            }
        }

        await this.prisma.employee.createMany({
            data: createData,
            skipDuplicates: true,
        });

        const credentials = await this.prisma.credential.findMany({
            where: { employeeId: { in: employeeIds }, type: 'PHOTO', isActive: true },
            select: { employeeId: true },
        });
        const credMap = new Map(credentials.map(c => [c.employeeId, true]));

        for (const gate of gates) {
            if (!gate.devices?.length) {
                this.gateway.server.emit('sync', {
                    syncId: null,
                    employee: null,
                    gate: { id: gate.id, name: gate.name },
                    device: null,
                    status: 'FIELD',
                    message: 'Device is not found this gate!',
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
                        device: {
                            id: device.id,
                            name: device.name || device.ipAddress,
                            ip: device.ipAddress,
                        },
                        status: 'SKIPPED',
                        message: 'Face is not supported.',
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
                            status: 'WAITING',
                        },
                    });

                    const emitBase = {
                        syncId: sync.id,
                        employee: { id: empId, name: employee?.name || 'Noma’lum' },
                        gate: { id: gate.id, name: gate.name },
                        device: {
                            id: device.id,
                            name: device.name || device.ipAddress,
                            ip: device.ipAddress,
                        },
                        timestamp: new Date().toISOString(),
                    };

                    this.gateway.server.emit('sync', {
                        ...emitBase,
                        status: 'IN_PROGRESS',
                        message: 'Boshlandi',
                        step: 'VALIDATION',
                    });

                    try {
                        if (!credMap.has(empId)) {
                            throw new Error('Photo credential is not found!');
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
                            }
                        );
                        await this.updateSync(sync.id, 'PROCESS', 'User created!');
                        this.gateway.server.emit('sync', {
                            ...emitBase,
                            status: 'WAITING',
                            message: 'User created!',
                            step: 'USER_CREATION',
                        });

                        if (!employee?.photo) throw new Error('Foto is not found!');

                        const photoUrl = `http://${ip}:${port}/storage/${employee.photo}`;
                        await this.hikvisionService.addFaceToUserViaURL(
                            empId.toString(),
                            photoUrl,
                            {
                                host: device.ipAddress,
                                port: 80,
                                protocol: 'http',
                                username: device.login,
                                password: device.password,
                            }
                        );

                        await this.updateSync(sync.id, 'DONE', 'Success!');
                        result.success++;
                        this.gateway.server.emit('sync', {
                            ...emitBase,
                            status: 'DONE',
                            message: 'Face successfully added!',
                            step: 'ADD_FACE',
                        });
                    } catch (err: any) {
                        const msg = err?.message || 'Undifined error';
                        await this.updateSync(sync.id, 'FIELD', msg);
                        this.gateway.server.emit('sync', {
                            ...emitBase,
                            status: 'FIELD',
                            message: msg,
                            step: 'VALIDATION',
                            error: msg,
                        });
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
            updatedAt: new Date().toISOString(),
        });

        return { success: true, message: 'Test emit yuborildi!' };
    }
}
