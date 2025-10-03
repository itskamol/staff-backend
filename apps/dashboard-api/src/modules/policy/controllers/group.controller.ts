import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { GroupService } from '../services/group.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateGroupDto, GroupDto, UpdateGroupDto, AddResourceToGroupDto } from '../dto/group.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';
import { ResourceType } from '@prisma/client';

@ApiTags('Policy Groups')
@Controller('policies/groups')
@ApiBearerAuth()
@ApiExtraModels(GroupDto, )
@Roles(Role.ADMIN, Role.HR)
export class GroupController {
    constructor(private readonly groupService: GroupService) {}

    @Get()
    @ApiCrudOperation(GroupDto, 'list', {
        summary: 'Get all groups with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                name: String,
                type: String,
                isActive: Boolean,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto & { type: ResourceType },
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.groupService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(GroupDto, 'get', { summary: 'Get group by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.groupService.findOne(id, user);
    }

    @Post()
    @ApiCrudOperation(GroupDto, 'create', {
        body: CreateGroupDto,
        summary: 'Create new group',
    })
    async create(@Body() createGroupDto: CreateGroupDto, @Scope() scope: DataScope) {
        return await this.groupService.create(createGroupDto, scope);
    }

    @Put(':id')
    @ApiCrudOperation(GroupDto, 'update', {
        body: UpdateGroupDto,
        summary: 'Update existing group',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateGroupDto: UpdateGroupDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.groupService.update(id, updateGroupDto, user);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete group by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.groupService.remove(id, scope, user);
    }

    @Post(':id/resources')
    @ApiCrudOperation(null, 'create', {
        body: AddResourceToGroupDto,
        summary: 'Add resources to group',
        errorResponses: { notFound: true, badRequest: true },
    })
    async addResources(
        @Param('id') id: number,
        @Body() addResourceDto: AddResourceToGroupDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.groupService.addResources(id, addResourceDto.resourceIds, user);
    }

    @Delete(':id/resources/:resourceId')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Remove resource from group',
        errorResponses: { notFound: true },
    })
    async removeResource(
        @Param('id') id: number,
        @Param('resourceId') resourceId: number,
        @CurrentUser() user: UserContext
    ) {
        return await this.groupService.removeResource(id, resourceId, user);
    }
}