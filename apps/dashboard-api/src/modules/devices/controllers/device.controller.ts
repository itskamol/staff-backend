import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { DeviceService } from '../services/device.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateDeviceDto, DeviceDto, UpdateDeviceDto, TestConnectionDto } from '../dto/device.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Devices')
@Controller('devices')
@ApiBearerAuth()
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}

    @Get()
    @Roles(Role.ADMIN, Role.GUARD)
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
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.deviceService.findAll(query, scope, user);
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.GUARD)
    @ApiCrudOperation(DeviceDto, 'get', { summary: 'Get device by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.deviceService.findOne(id, user);
    }

    @Post()
    @Roles(Role.ADMIN)
    @ApiCrudOperation(DeviceDto, 'create', {
        body: CreateDeviceDto,
        summary: 'Create new device',
    })
    async create(@Body() createDeviceDto: CreateDeviceDto, @Scope() scope: DataScope) {
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
        @CurrentUser() user: UserContext
    ) {
        return await this.deviceService.update(id, updateDeviceDto, user);
    }

    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete device by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.deviceService.remove(id, scope, user);
    }

    @Post(':id/test-connection')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(null, 'create', {
        body: TestConnectionDto,
        summary: 'Test device connection',
        errorResponses: { notFound: true, badRequest: true },
    })
    async testConnection(
        @Param('id') id: number,
        @Body() testConnectionDto: TestConnectionDto
    ) {
        return await this.deviceService.testConnection(id, testConnectionDto.timeout);
    }
}