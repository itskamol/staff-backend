import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope, Scope } from '@app/shared/auth';
import { GateService } from '../services/gate.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateGateDto, GateDto, UpdateGateDto } from '../dto/gate.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

@ApiTags('Gates')
@Controller('gates')
@ApiExtraModels(GateDto)
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GUARD, Role.HR)
export class GateController {
    constructor(private readonly gateService: GateService) {}

    @Get()
    @ApiCrudOperation(GateDto, 'list', {
        summary: 'Get all gates with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.gateService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(GateDto, 'get', { summary: 'Get gate by ID' })
    async findOne(@Param('id') id: number, @Scope() scope: DataScope) {
        return this.gateService.findOne(id, scope);
    }

    @Get(':id/statistics')
    @ApiCrudOperation(null, 'get', {
        summary: 'Get gate statistics',
        errorResponses: { notFound: true },
    })
    async getStatistics(@Param('id') id: number, @Scope() scope: DataScope) {
        return this.gateService.getGateStatistics(id, scope);
    }

    @Get(':id/devices')
    @ApiCrudOperation(null, 'get', {
        summary: 'Get gate with active devices',
        errorResponses: { notFound: true },
    })
    async getWithDevices(@Param('id') id: number, @Scope() scope: DataScope) {
        return this.gateService.getGateWithDevices(id, scope);
    }

    @Post()
    @ApiCrudOperation(GateDto, 'create', {
        body: CreateGateDto,
        summary: 'Create new gate',
    })
    async create(@Body() createGateDto: CreateGateDto, @Scope() scope: DataScope) {
        return this.gateService.create(createGateDto, scope);
    }

    @Put(':id')
    @ApiCrudOperation(GateDto, 'update', {
        body: UpdateGateDto,
        summary: 'Update existing gate',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateGateDto: UpdateGateDto,
        @Scope() scope: DataScope
    ) {
        return this.gateService.update(id, updateGateDto, scope);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete gate by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        return this.gateService.remove(id, scope, user);
    }
}
