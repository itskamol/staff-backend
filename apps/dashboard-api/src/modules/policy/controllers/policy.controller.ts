import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { PolicyService } from '../services/policy.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreatePolicyDto, PolicyDto, UpdatePolicyDto } from '../dto/policy.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Policies')
@Controller('policies')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.HR)
export class PolicyController {
    constructor(private readonly policyService: PolicyService) {}

    @Get()
    @ApiCrudOperation(PolicyDto, 'list', {
        summary: 'Get all policies with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                title: String,
                isActiveWindowEnabled: Boolean,
                isScreenshotEnabled: Boolean,
                isVisitedSitesEnabled: Boolean,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.policyService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(PolicyDto, 'get', { summary: 'Get policy by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.policyService.findOne(id, user);
    }

    @Post()
    @ApiCrudOperation(PolicyDto, 'create', {
        body: CreatePolicyDto,
        summary: 'Create new policy',
    })
    async create(@Body() createPolicyDto: CreatePolicyDto, @Scope() scope: DataScope) {
        return await this.policyService.create(createPolicyDto, scope);
    }

    @Put(':id')
    @ApiCrudOperation(PolicyDto, 'update', {
        body: UpdatePolicyDto,
        summary: 'Update existing policy',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updatePolicyDto: UpdatePolicyDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.policyService.update(id, updatePolicyDto, user);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete policy by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.policyService.remove(id, scope, user);
    }
}
