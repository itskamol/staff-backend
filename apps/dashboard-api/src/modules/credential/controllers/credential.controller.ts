import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataScope, Roles, Scope, User, UserContext } from '@app/shared/auth';
import {
    CreateCredentialDto,
    UpdateCredentialDto,
    CredentialResponseDto,
    CredentialQueryDto,
} from '../dto/credential.dto';
import { ActionType, Role } from '@prisma/client';
import { CredentialService } from '../services/credential.services';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

@ApiTags('Credentials')
@ApiBearerAuth()
@Controller('credentials')
@Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
export class CredentialController {
    constructor(private readonly credentialService: CredentialService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new credential and assign it to an employee' })
    @ApiResponse({ status: 201, type: CredentialResponseDto })
    async create(
        @Body() dto: CreateCredentialDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.credentialService.createCredential(dto, scope, user);
    }

    @Get()
    @ApiOperation({ summary: 'Get all credentials with filters, search and pagination' })
    @ApiResponse({ status: 200, type: [CredentialResponseDto] })
    async getAll(
        @Query() query: CredentialQueryDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.credentialService.getAllCredentials(query, scope, user);
    }

    @Get('/by-employee/:employeeId')
    @ApiParam({ name: 'employeeId', type: Number })
    @ApiOperation({ summary: 'Get all credentials for a specific employee' })
    @ApiResponse({ status: 200, type: [CredentialResponseDto] })
    async getByEmployeeId(
        @Param('employeeId') employeeId: number,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.credentialService.getCredentialsByEmployeeId(employeeId, scope, user);
    }

    @Get('/get-action-type')
    @ApiOperation({ summary: 'Get Action type' })
    @ApiResponse({ status: 200, type: Object })
    async getActionType() {
        return ActionType;
    }

    @Get(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Get a credential by its ID' })
    @ApiResponse({ status: 200, type: CredentialResponseDto })
    async getById(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.credentialService.getCredentialById(id, scope, user);
    }

    @Put(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Update an existing credential' })
    @ApiResponse({ status: 200, type: CredentialResponseDto })
    async update(
        @Param('id') id: number,
        @Body() dto: UpdateCredentialDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.credentialService.updateCredential(id, dto, scope, user);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Delete a credential by ID' })
    @ApiResponse({ status: 200, description: 'Credential successfully deleted' })
    async delete(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.credentialService.deleteCredential(id, scope, user);
    }
}
