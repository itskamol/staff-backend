import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope, Scope } from '@app/shared/auth';
import { ResourceService } from '../services/resource.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { ResourceQueryDto, ResourceResponseDto } from '../dto/resource.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';

@ApiTags('Resources')
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
                groupId: Number,
            },
        },
    })
    async findAll(
        @Query() query: ResourceQueryDto,
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
}