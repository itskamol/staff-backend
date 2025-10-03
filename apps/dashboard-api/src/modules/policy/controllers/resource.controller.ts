import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { ResourceService } from '../services/resource.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateResourceDto, ResourceResponseDto, UpdateResourceDto } from '../dto/resource.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Policy Resources')
@Controller('policies/resources')
@ApiBearerAuth()
@ApiExtraModels(ResourceResponseDto)
@Roles(Role.ADMIN, Role.HR)
export class ResourceController {
    constructor(private readonly resourceService: ResourceService) {}

    @Get()
    @ApiCrudOperation(ResourceResponseDto, 'list', {
        summary: 'Get all resources with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                value: String,
                type: String,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.resourceService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(ResourceResponseDto, 'get', { summary: 'Get resource by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.resourceService.findOne(id, user);
    }

    @Post()
    @ApiCrudOperation(ResourceResponseDto, 'create', {
        body: CreateResourceDto,
        summary: 'Create new resource',
    })
    async create(@Body() createResourceDto: CreateResourceDto, @Scope() scope: DataScope) {
        return await this.resourceService.create(createResourceDto, scope);
    }

    @Post('bulk')
    @ApiCrudOperation(null, 'create', {
        summary: 'Bulk create resources',
        errorResponses: { badRequest: true },
    })
    async bulkCreate(
        @Body() createResourceDtos: CreateResourceDto[],
        @Scope() scope: DataScope
    ) {
        return await this.resourceService.bulkCreate(createResourceDtos, scope);
    }

    @Put(':id')
    @ApiCrudOperation(ResourceResponseDto, 'update', {
        body: UpdateResourceDto,
        summary: 'Update existing resource',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateResourceDto: UpdateResourceDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.resourceService.update(id, updateResourceDto, user);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete resource by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.resourceService.remove(id, scope, user);
    }
}