import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { VisitorService } from '../services/visitor.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import { CreateVisitorDto, VisitorWithRelationsDto, UpdateVisitorDto, GenerateCodeDto, CreateOnetimeCodeDto } from '../dto/visitor.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { Scope } from 'apps/dashboard-api/src/shared/decorators';

@ApiTags('Visitors')
@Controller('visitors')
@ApiBearerAuth()
export class VisitorController {
    constructor(private readonly visitorService: VisitorService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(VisitorWithRelationsDto, 'list', {
        summary: 'Get all visitors with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                creatorId: Number,
                isActive: Boolean,
            },
        },
    })
    async findAll(
        @Query() query: QueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.visitorService.findAll(query, scope, user);
    }

    @Get('today')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(VisitorWithRelationsDto, 'list', {
        summary: 'Get today\'s visitors',
    })
    async findTodayVisitors() {
        return await this.visitorService.findTodayVisitors();
    }

    @Get('active-codes')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(VisitorWithRelationsDto, 'list', {
        summary: 'Get visitors with active codes',
    })
    async findWithActiveCodes() {
        return await this.visitorService.findWithActiveCodes();
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(VisitorWithRelationsDto, 'get', { summary: 'Get visitor by ID' })
    async findOne(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.visitorService.findOne(id, user);
    }

    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(VisitorWithRelationsDto, 'create', {
        body: CreateVisitorDto,
        summary: 'Create new visitor',
    })
    async create(@Body() createVisitorDto: CreateVisitorDto, @Scope() scope: DataScope) {
        return await this.visitorService.create(createVisitorDto, scope);
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(VisitorWithRelationsDto, 'update', {
        body: UpdateVisitorDto,
        summary: 'Update existing visitor',
        errorResponses: { notFound: true, forbidden: true },
    })
    async update(
        @Param('id') id: number,
        @Body() updateVisitorDto: UpdateVisitorDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.visitorService.update(id, updateVisitorDto, user);
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete visitor by ID',
        errorResponses: { notFound: true, forbidden: true },
    })
    async remove(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.visitorService.remove(id, scope, user);
    }

    @Post(':id/generate-code')
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(null, 'create', {
        body: GenerateCodeDto,
        summary: 'Generate onetime code for visitor',
        errorResponses: { notFound: true, badRequest: true },
    })
    async generateCode(
        @Param('id') id: number,
        @Body() generateCodeDto: GenerateCodeDto,
        @CurrentUser() user: UserContext
    ) {
        return await this.visitorService.generateCode(id, generateCodeDto, user);
    }

    @Get(':id/actions')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(null, 'list', {
        summary: 'Get visitor actions (entry/exit logs)',
    })
    async getActions(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.visitorService.getActions(id, user);
    }

    @Get('validate-code/:code')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(null, 'get', {
        summary: 'Validate visitor code',
        errorResponses: { notFound: true, badRequest: true },
    })
    async validateCode(@Param('code') code: string) {
        return await this.visitorService.validateCode(code);
    }
}