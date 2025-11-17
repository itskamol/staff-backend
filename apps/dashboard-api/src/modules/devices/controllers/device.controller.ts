import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import { Roles, Role, DataScope, User, Scope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { DeviceService } from '../services/device.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import {
    CreateDeviceDto,
    DeviceDto,
    UpdateDeviceDto,
    TestConnectionDto,
    AssignEmployeesToGatesDto,
} from '../dto/device.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';

@ApiTags('Devices')
@Controller('devices')
@ApiExtraModels(DeviceDto)
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GUARD, Role.HR)
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    @Get('test-config')
    testSocket() {
        return this.deviceService.configCheck();
    }

    @Get()
    @ApiCrudOperation(DeviceDto, 'list', {
        summary: 'Get all devices with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                type: String,
                status: String,
                is_active: Boolean,
                gateId: Number,
            },
        },
    })
    async findAll(@Query() query: QueryDto, @User() user: UserContext, @Scope() scope: DataScope) {
        return await this.deviceService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(DeviceDto, 'get', { summary: 'Get device by ID' })
    async findOne(@Param('id') id: number, @User() scope: DataScope) {
        return await this.deviceService.findOne(id, scope);
    }

    @Post()
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
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete device by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(@Param('id') id: number, @Scope() scope: DataScope, @User() user: UserContext) {
        return await this.deviceService.remove(id, scope, user);
    }

    @Post(':id/test-connection')
    @ApiCrudOperation(null, 'create', {
        body: TestConnectionDto,
        summary: 'Test device connection',
        errorResponses: { notFound: true, badRequest: true },
    })
    async testConnection(@Param('id') id: number, @Body() testConnectionDto: TestConnectionDto) {
        return await this.deviceService.testConnection(id, testConnectionDto.timeout);
    }

    @Post('assign-employees')
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
}
