import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataScope, UserContext } from '@app/shared/auth';
import {
    AssignEmployeesToGatesDto,
    ConnectionDto,
    CreateDeviceDto,
    QueryDeviceDto,
    SyncCredentialsDto,
    UpdateDeviceDto,
} from '../dto/device.dto';
import { DeviceRepository } from '../repositories/device.repository';
import { ActionType, EntryType, Prisma, StatusEnum } from '@prisma/client';
import { GateRepository } from '../../gate/repositories/gate.repository';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { ConfigService } from 'apps/dashboard-api/src/core/config/config.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { EncryptionService } from 'apps/dashboard-api/src/shared/services/encryption.service';
import { GateDto } from '../../gate/dto/gate.dto';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { PrismaService } from '@app/shared/database';

@Injectable()
export class DeviceService {
    constructor(
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue,
        private readonly deviceRepository: DeviceRepository,
        private readonly gateRepository: GateRepository,
        private hikvisionService: HikvisionAccessService,
        private readonly configService: ConfigService,
        private readonly encryptionService: EncryptionService,
        private readonly prisma: PrismaService
    ) {}

    async findAll(query: QueryDeviceDto, scope: DataScope, user: UserContext) {
        const {
            page,
            limit,
            sort = 'createdAt',
            order = 'desc',
            search,
            deviceTypes,
            gateId,
            isConnected,
        } = query;
        const where: Prisma.DeviceWhereInput = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { ipAddress: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (deviceTypes) {
            where.type = { hasSome: deviceTypes };
        }

        if (isConnected) {
            where.gateId = { not: null };
        }

        if (isConnected === false) {
            where.gateId = null;
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

        if (!device || device.deletedAt !== null) {
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
            type: dtoData.deviceTypes,
            entryType: dtoData.entryType || EntryType.BOTH,
            welcomeText: dtoData.welcomeText || null,
            welcomeTextType: dtoData.welcomeTextType || null,
            welcomePhoto: dtoData.welcomePhoto || null,
            welcomePhotoType: dtoData.welcomePhotoType || null,
            isActive: dtoData.isActive !== undefined ? dtoData.isActive : true,
            capabilities,
        };

        const newDevice: CreateDeviceDto = await this.deviceRepository.create(
            {
                ...device,
                ...(gateId && {
                    gate: {
                        connect: { id: gateId },
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

        if (gateId) {
            await this.deviceQueue.add(JOB.DEVICE.CREATE, {
                hikvisionConfig,
                newDevice: newDevice,
                gateId,
                scope,
            });
        }

        return newDevice;
    }

    async update(id: number, updateDeviceDto: UpdateDeviceDto, scope: DataScope) {
        // 1. Amaldagi qurilmani bazadan olamiz (Solishtirish uchun)
        const currentDevice = await this.findOne(id, scope);

        const { gateId, ipAddress, deviceTypes, ...dtoData } = updateDeviceDto;

        // 2. IP manzili va Gate kombinatsiyasi band emasligini tekshirish
        if (gateId || ipAddress) {
            const checkIp = ipAddress || currentDevice.ipAddress;
            const checkGate = gateId !== undefined ? gateId : currentDevice.gateId;

            if (checkIp && checkGate) {
                const collision = await this.deviceRepository.findOneByGateAndIp(
                    checkGate,
                    checkIp
                );
                if (collision && collision.id !== id) {
                    throw new BadRequestException(
                        'This gate already has a device with the same IP address'
                    );
                }
            }
        }

        // 3. Yangi Gate mavjudligini tekshirish
        if (gateId) {
            const gate = await this.gateRepository.findById(gateId, {}, scope);
            if (!gate) throw new NotFoundException('Gate not found');
        }

        // 4. Bazada yangilash
        const updatedDevice = await this.deviceRepository.update(
            id,
            {
                ...dtoData,
                type: deviceTypes,
                ...(gateId !== undefined && {
                    gate: gateId ? { connect: { id: gateId } } : { disconnect: true },
                }),
            },
            {
                gate: { select: { id: true, name: true } },
            },
            scope
        );

        if (gateId !== undefined && gateId !== currentDevice.gateId) {
            if (currentDevice.gateId) {
                const oldGate = await this.gateRepository.findById(currentDevice.gateId, {
                    employees: true,
                });

                if (oldGate?.employees?.length) {
                    await this.deviceQueue.add(JOB.DEVICE.CLEAR_ALL_USERS_FROM_DEVICE, {
                        deviceId: id,
                    });
                }
            }

            if (gateId) {
                const hikvisionConfig: HikvisionConfig = {
                    host: updatedDevice.ipAddress,
                    port: 80,
                    username: updatedDevice.login,
                    password: updatedDevice.password,
                    protocol: 'http',
                };

                await this.deviceQueue.add(JOB.DEVICE.CREATE, {
                    hikvisionConfig,
                    newDevice: updatedDevice,
                    gateId,
                    scope,
                });
            }
        }

        return updatedDevice;
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

        if (!device || device.deletedAt !== null) {
            throw new NotFoundException('Device not found');
        }

        if (device.gateId) {
            await this.deviceRepository.update(id, {
                gate: {
                    disconnect: { id: device?.gateId },
                },
            });
        }

        const deviceId = device.id;

        const job = await this.deviceQueue.add(JOB.DEVICE.DELETE, { deviceId });

        const result = await this.deviceRepository.softDelete(id, scope);
        return { message: 'Device deleted successfully', ...result };
    }

    async findByType(type: ActionType) {
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

    async assignEmployeesToGates(
        dto: AssignEmployeesToGatesDto,
        scope: DataScope,
        user?: UserContext
    ) {
        const job = await this.deviceQueue.add(JOB.DEVICE.ASSIGN_EMPLOYEES_TO_GATES, {
            dto,
            scope,
        });

        return { success: true };
    }

    async connectGateToDevices(dto: ConnectionDto, scope: DataScope) {
        const { gateId, deviceIds } = dto;

        const gate = await this.gateRepository.findById(gateId);
        if (!gate) {
            throw new NotFoundException('Gate not found');
        }

        const devices = await this.deviceRepository.findMany(
            { id: { in: deviceIds } },
            undefined,
            undefined,
            undefined,
            undefined,
            scope
        );

        for (const device of devices) {
            let { id } = device;
            await this.deviceRepository.update(
                id,
                {
                    gate: {
                        connect: { id: gateId },
                    },
                },
                {},
                scope
            );

            const hikvisionConfig: HikvisionConfig = {
                host: device.ipAddress,
                port: 80,
                username: device.login,
                password: device.password,
                protocol: 'http',
            };

            await this.deviceQueue.add(JOB.DEVICE.CREATE, {
                hikvisionConfig,
                newDevice: device,
                gateId,
                scope,
            });
        }

        return { success: true, connectedCount: devices.length };
    }

    async unlockDoor(deviceId: number, doorNo: number = 1, scope?: DataScope) {
        try {
            const device = await this.deviceRepository.findById(deviceId, {}, scope);

            if (!device) {
                throw new NotFoundException('Device not found');
            }

            const hikvisionConfig: HikvisionConfig = {
                host: device.ipAddress,
                port: 80,
                username: device.login,
                password: device.password,
                protocol: device.protocol || 'http',
            };

            const result = await this.hikvisionService.openDoor(doorNo, hikvisionConfig);
            if (!result) {
                throw new BadRequestException('Failed to unlock the door on the device');
            }

            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    async getEmployeeGateCredentials(gateId: number, employeeId: number, scope: DataScope) {
        const allCredentials = await this.prisma.credential.findMany({
            where: { employeeId, isActive: true, deletedAt: null },
        });

        if (!gateId || !employeeId) {
            throw new BadRequestException('gateId and employeeId required!');
        }

        const activeSyncs = await this.prisma.employeeSync.findMany({
            where: {
                gateId,
                employeeId,
                deletedAt: null,
                status: StatusEnum.DONE,
            },
            select: { credentialId: true },
        });

        const syncedIds = activeSyncs.map(s => s.credentialId);

        return allCredentials.map(cred => ({
            ...cred,
            isAssignedToGate: syncedIds.includes(cred.id),
        }));
    }

    async updateEmployeeGateAccessByIds(dto: {
        gateId: number;
        employeeId: number;
        credentialIds: number[];
    }) {
        const { gateId, employeeId, credentialIds } = dto;

        const currentSyncs = await this.prisma.employeeSync.findMany({
            where: { gateId, employeeId, deletedAt: null },
        });
        const currentSyncedCredIds = currentSyncs.map(s => s.credentialId);

        const toRemoveIds = currentSyncedCredIds.filter(id => !credentialIds.includes(id));
        const toAddIds = credentialIds.filter(id => !currentSyncedCredIds.includes(id));

        // 1. O'CHIRISH - Avvalgi removeSpecificCredentialsJob'ni ishlataveramiz
        if (toRemoveIds.length > 0) {
            await this.deviceQueue.add(JOB.DEVICE.REMOVE_SPECIFIC_CREDENTIALS, {
                gateId,
                employeeId,
                credentialIds: toRemoveIds,
            });
        }

        // 2. QO'SHISH - Yangi, xavfsiz job
        if (toAddIds.length > 0) {
            await this.deviceQueue.add(JOB.DEVICE.SYNC_CREDENTIALS_TO_DEVICES, {
                // <-- Yangi job nomi
                gateId,
                employeeId,
                credentialIds: toAddIds,
            });
        }

        return { success: true };
    }
}
