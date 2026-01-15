import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import { Roles, Role, DataScope, User, Scope, UserContext } from '@app/shared/auth';
import { DeviceService } from '../services/device.service';
import {
    CreateDeviceDto,
    DeviceDto,
    UpdateDeviceDto,
    QueryDeviceDto,
    ConnectionDto,
    SyncCredentialsDto,
    AssignEmployeesToDevicesDto,
} from '../dto/device.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import {
    UpdateDeviceAuthDto,
    UpdateDeviceTimeDto,
    UpdateResultDeviceDisplayDto,
} from '../dto/device.edit.dto';

@ApiTags('Devices')
@Controller('devices')
@ApiExtraModels(DeviceDto)
@ApiBearerAuth()
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    @Get()
    @Roles(Role.ADMIN, Role.GUARD)
    @ApiCrudOperation(DeviceDto, 'list', {
        summary: 'Get all devices with pagination',
    })
    async findAll(
        @Query() query: QueryDeviceDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.deviceService.findAll(query, scope, user);
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.GUARD)
    @ApiCrudOperation(DeviceDto, 'get', { summary: 'Get device by ID' })
    async findOne(@Param('id') id: number, @User() scope: DataScope) {
        return await this.deviceService.findOne(id, scope);
    }

    @Post()
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'create', {
        body: CreateDeviceDto,
        summary: 'Create new device',
    })
    async create(
        @Body() createDeviceDto: CreateDeviceDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return await this.deviceService.create(createDeviceDto, scope);
    }

    @Put('device-time/:id')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'update', {
        body: UpdateDeviceAuthDto,
        summary: 'Update device auth',
        errorResponses: { notFound: true, forbidden: true },
    })
    async updateTime(
        @Param('id') id: number,
        @Body() updateDeviceDto: UpdateDeviceAuthDto,
        @Scope() scope: UserContext
    ) {
        return await this.deviceService.updateDeviceAuth(id, updateDeviceDto, scope);
    }

    @Put('display/:id')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'update', {
        body: UpdateResultDeviceDisplayDto,
        summary: 'Update device auth display result',
        errorResponses: { notFound: true, forbidden: true },
    })
    async updateDisplayResult(
        @Param('id') id: number,
        @Body() updateDeviceDto: UpdateResultDeviceDisplayDto,
        @Scope() scope: UserContext
    ) {
        return await this.deviceService.updateDisplayResult(id, updateDeviceDto, scope);
    }

    @Put('credential-auth/:id')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'update', {
        body: UpdateResultDeviceDisplayDto,
        summary: 'Update device auth display result',
        errorResponses: { notFound: true, forbidden: true },
    })
    async updateDeviceAuth(
        @Param('id') id: number,
        @Body() updateDeviceDto: UpdateResultDeviceDisplayDto,
        @Scope() scope: UserContext
    ) {
        return await this.deviceService.updateDisplayResult(id, updateDeviceDto, scope);
    }

    @Put(':id')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'update', {
        body: UpdateDeviceDto,
        summary: 'Update existing device',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateDeviceDto: UpdateDeviceDto,
        @Scope() scope: UserContext
    ) {
        return await this.deviceService.update(id, updateDeviceDto, scope);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete device by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(@Param('id') id: number, @Scope() scope: DataScope, @User() user: UserContext) {
        return await this.deviceService.remove(id, scope, user);
    }

    @Post('assign-employees')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'create', {
        summary: 'Assign employees from devices for facial access',
    })
    @ApiResponse({
        status: 200,
        description: 'Biriktirish natijasi',
        schema: {
            example: {
                total: 10,
                success: 8,
                errors: ['Gate 2, Device 5: Credential topilmadi'],
                details: [
                    {
                        gateId: 1,
                        deviceId: 3,
                        employeeId: 5,
                        status: 'ok',
                    },
                ],
            },
        },
    })
    async assignEmployeesToDevices(
        @Body() dto: AssignEmployeesToDevicesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.deviceService.assignEmployeesToDevices(dto, scope, user);
    }

    @Post('remove-employees')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'create', {
        summary: 'Remove employees from devices for facial access',
    })
    @ApiResponse({
        status: 200,
        description: 'Biriktirish natijasi',
        schema: {
            example: {
                total: 10,
                success: 8,
                errors: ['Gate 2, Device 5: Credential topilmadi'],
                details: [
                    {
                        gateId: 1,
                        deviceId: 3,
                        employeeId: 5,
                        status: 'ok',
                    },
                ],
            },
        },
    })
    async removeEmployeesToDevices(
        @Body() dto: AssignEmployeesToDevicesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.deviceService.removeEmployeesToDevices(dto, scope, user);
    }

    @Post('openDoor/:id')
    @Roles(Role.ADMIN, Role.GUARD)
    @ApiCrudOperation(DeviceDto, 'create', {
        summary: 'Open device by ID',
    })
    async openDoor(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return await this.deviceService.unlockDevice(id, 1, scope);
    }

    @Post('connectDevicesToGate')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(ConnectionDto, 'create', {
        body: ConnectionDto,
        summary: 'Gate connect with devices',
    })
    async connectDevicesToGate(
        @Body() dto: ConnectionDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return await this.deviceService.connectGateToDevices(dto, scope);
    }

    @Get('gate/:gateId/employee/:employeeId/credentials')
    @Roles(Role.ADMIN)
    async getEmployeeCredentialsStatus(
        @Param('gateId') gateId: number,
        @Param('employeeId') employeeId: number,
        @Scope() scope: DataScope
    ) {
        return await this.deviceService.getEmployeeGateCredentials(gateId, employeeId);
    }

    @Post('gate/sync-credentials')
    @Roles(Role.ADMIN)
    async syncCredentials(@Body() dto: SyncCredentialsDto, @Scope() scope: DataScope) {
        return await this.deviceService.updateEmployeeGateAccessByIds(dto);
    }
}
