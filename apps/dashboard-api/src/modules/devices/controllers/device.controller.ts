import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import { Roles, Role, DataScope, User, Scope, UserContext } from '@app/shared/auth';
import { DeviceService } from '../services/device.service';
import {
    CreateDeviceDto,
    DeviceDto,
    UpdateDeviceDto,
    AssignEmployeesToGatesDto,
    QueryDeviceDto,
} from '../dto/device.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';

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
        summary: 'Assign employees to gate devices for facial access',
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
    async assignEmployeesToGates(
        @Body() dto: AssignEmployeesToGatesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.deviceService.assignEmployeesToGates(dto, scope, user);
    }

    @Post('openDoor/:id')
    @Roles(Role.ADMIN, Role.GUARD)
    @ApiCrudOperation(DeviceDto, 'create', {
        summary: 'Open door for device by ID',
    })
    async openDoor(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return await this.deviceService.unlockDoor(id, 1, scope);
    }
}
