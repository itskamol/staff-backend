import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataScope, Roles, Scope, User, UserContext } from '@app/shared/auth';
import { CreateCredentialDto, UpdateCredentialDto, CredentialResponseDto, CredentialQueryDto } from '../dto/credential.dto';
import { ActionType, Role } from '@prisma/client';
import { CredentialService } from '../services/credential.services';

@ApiTags('Credentials')
@ApiBearerAuth()
@Controller('credentials')
export class CredentialController {
    constructor(private readonly credentialService: CredentialService) { }


    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Create a new credential and assign it to an employee' })
    @ApiResponse({ status: 201, type: CredentialResponseDto })
    async create(
        @Body() dto: CreateCredentialDto,
        @User() user,
        @Scope() scope: DataScope,
    ) {
        return this.credentialService.createCredential(dto, scope, user);
    }

    @Get()
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiOperation({ summary: 'Get all credentials with filters, search and pagination' })
    @ApiResponse({ status: 200, type: [CredentialResponseDto] })
    async getAll(
        @Query() query: CredentialQueryDto,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ) {
        return this.credentialService.getAllCredentials(query, scope, user);
    }


    @Get('/by-employee/:employeeId')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiParam({ name: 'employeeId', type: Number })
    @ApiOperation({ summary: 'Get all credentials for a specific employee' })
    @ApiResponse({ status: 200, type: [CredentialResponseDto] })
    async getByEmployeeId(
        @Param('employeeId') employeeId: number,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ) {
        return this.credentialService.getCredentialsByEmployeeId(employeeId, scope, user);
    }

    @Get('/get-action-type')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiOperation({ summary: 'Get Action type' })
    @ApiResponse({ status: 200, type: Object })
    async getActionType() {
        return ActionType;
    }


    @Get(':id')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Get a credential by its ID' })
    @ApiResponse({ status: 200, type: CredentialResponseDto })
    async getById(
        @Param('id') id: number,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ) {
        return this.credentialService.getCredentialById(id, scope, user);
    }


    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Update an existing credential' })
    @ApiResponse({ status: 200, type: CredentialResponseDto })
    async update(
        @Param('id') id: number,
        @Body() dto: UpdateCredentialDto,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ) {
        return this.credentialService.updateCredential(id, dto, scope, user);
    }


    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Delete a credential by ID' })
    @ApiResponse({ status: 200, description: 'Credential successfully deleted' })
    async delete(
        @Param('id') id: number,
        @User() user: UserContext,
        @Scope() scope: DataScope,
    ) {
        return this.credentialService.deleteCredential(id, scope, user);
    }
}
