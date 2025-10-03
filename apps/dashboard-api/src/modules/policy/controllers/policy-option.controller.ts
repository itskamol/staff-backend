import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { PolicyOptionService } from '../services/policy-option.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { 
    CreatePolicyOptionDto, 
    PolicyOptionWithRelationsDto, 
    UpdatePolicyOptionDto,
    BulkCreatePolicyOptionDto, 
    BulkResponsePolicyOptionDto
} from '../dto/policy-option.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Policy Options')
@Controller('policies/options')
@ApiBearerAuth()
@ApiExtraModels(PolicyOptionWithRelationsDto, BulkResponsePolicyOptionDto)
@Roles(Role.ADMIN, Role.HR)
export class PolicyOptionController {
    constructor(private readonly policyOptionService: PolicyOptionService) {}

    @Get()
    @ApiCrudOperation(PolicyOptionWithRelationsDto, 'list', {
        summary: 'Get all policy options with pagination',
        includeQueries: {
            pagination: true,
            search: false,
            sort: true,
            filters: {
                policyId: Number,
                groupId: Number,
                type: String,
                isActive: Boolean,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.policyOptionService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(PolicyOptionWithRelationsDto, 'get', { summary: 'Get policy option by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.policyOptionService.findOne(id, user);
    }

    @Post()
    @ApiCrudOperation(PolicyOptionWithRelationsDto, 'create', {
        body: CreatePolicyOptionDto,
        summary: 'Create new policy option',
    })
    async create(@Body() createPolicyOptionDto: CreatePolicyOptionDto, @Scope() scope: DataScope) {
        return await this.policyOptionService.create(createPolicyOptionDto, scope);
    }

    @Post('bulk')
    @ApiCrudOperation(BulkResponsePolicyOptionDto, 'create', {
        body: BulkCreatePolicyOptionDto,
        summary: 'Bulk create policy options',
        errorResponses: { badRequest: true, notFound: true },
    })
    async bulkCreate(
        @Body() bulkCreateDto: BulkCreatePolicyOptionDto,
        @Scope() scope: DataScope
    ) {
        return await this.policyOptionService.bulkCreate(bulkCreateDto, scope);
    }

    @Put(':id')
    @ApiCrudOperation(PolicyOptionWithRelationsDto, 'update', {
        body: UpdatePolicyOptionDto,
        summary: 'Update existing policy option',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updatePolicyOptionDto: UpdatePolicyOptionDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.policyOptionService.update(id, updatePolicyOptionDto, user);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete policy option by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.policyOptionService.remove(id, scope, user);
    }

    @Get('policy/:policyId')
    @ApiCrudOperation(PolicyOptionWithRelationsDto, 'list', {
        summary: 'Get policy options by policy ID',
    })
    async findByPolicyId(@Param('policyId') policyId: number) {
        return await this.policyOptionService.findByPolicyId(policyId);
    }

    @Get('group/:groupId')
    @ApiCrudOperation(PolicyOptionWithRelationsDto, 'list', {
        summary: 'Get policy options by group ID',
    })
    async findByGroupId(@Param('groupId') groupId: number) {
        return await this.policyOptionService.findByGroupId(groupId);
    }
}