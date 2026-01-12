import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels, ApiResponse } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser, DataScope, Scope, User } from '@app/shared/auth';
import { VisitorService } from '../services/visitor.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';
import {
    CreateVisitorDto,
    VisitorWithRelationsDto,
    UpdateVisitorDto,
    QueryVisitorDto,
    VisitorDto,
    AssignVisitorToGatesDto,
} from '../dto/visitor.dto';
import { ApiCrudOperation } from 'apps/dashboard-api/src/shared/utils';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';
import { ApiSuccessResponse } from '@app/shared/utils';

@ApiTags('Visitors')
@Controller('visitors')
@ApiBearerAuth()
@ApiExtraModels(ApiSuccessResponse, VisitorWithRelationsDto)
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
        },
    })
    async findAll(
        @Query() query: QueryVisitorDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.visitorService.findAll(query, scope, user);
    }

    @Get('today')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(VisitorWithRelationsDto, 'list', {
        summary: "Get today's visitors",
    })
    async findTodayVisitors() {
        return await this.visitorService.findTodayVisitors();
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
    async create(
        @Body() createVisitorDto: CreateVisitorDto,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        return await this.visitorService.create(createVisitorDto, scope, user);
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

    @Get(':id/actions')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(null, 'list', {
        summary: 'Get visitor actions (entry/exit logs)',
    })
    async getActions(@Param('id') id: number, @CurrentUser() user: UserContext) {
        return await this.visitorService.getActions(id, user);
    }

    @Post('assign-visitors-to-gates')
    @Roles(Role.ADMIN)
    @ApiCrudOperation(VisitorWithRelationsDto, 'create', {
        summary: 'Assign visitors to gate devices for facial access',
    })
    async assignEmployeesToGates(
        @Body() dto: AssignVisitorToGatesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.visitorService.assignVisitorToGates(dto, scope, user);
    }
}
