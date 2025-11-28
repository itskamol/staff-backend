import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataScope, Roles, Scope, User, UserContext } from '@app/shared/auth';
import { Role } from '@prisma/client';
import {
    CreateReasonDto,
    UpdateReasonDto,
    ReasonResponseDto,
    ReasonQueryDto,
} from '../dto/reason.dto';
import { ReasonService } from '../service/reason.service';

@ApiTags('Reasons')
@ApiBearerAuth()
@Controller('reasons')
@Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
export class ReasonController {
    constructor(private readonly reasonService: ReasonService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new reason' })
    @ApiResponse({ status: 201, type: ReasonResponseDto })
    async create(
        @Body() dto: CreateReasonDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.reasonService.createReason(dto, scope, user);
    }

    @Get()
    @ApiOperation({ summary: 'Get all reasons with filters and pagination' })
    @ApiResponse({ status: 200, type: [ReasonResponseDto] })
    async getAll(
        @Query() query: ReasonQueryDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.reasonService.getAllReasons(query, scope, user);
    }

    @Get(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Get a reason by ID' })
    @ApiResponse({ status: 200, type: ReasonResponseDto })
    async getById(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.reasonService.getReasonById(id, scope, user);
    }

    @Put(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Update an existing reason' })
    @ApiResponse({ status: 200, type: ReasonResponseDto })
    async update(
        @Param('id') id: number,
        @Body() dto: UpdateReasonDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.reasonService.updateReason(id, dto, scope, user);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Delete a reason by ID' })
    @ApiResponse({ status: 200, description: 'Reason successfully deleted' })
    async delete(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.reasonService.deleteReason(id, scope, user);
    }
}
