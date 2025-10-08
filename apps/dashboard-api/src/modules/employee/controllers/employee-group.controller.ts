import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiExtraModels } from '@nestjs/swagger';
import { Roles, Role, DataScope } from '@app/shared/auth';
import { QueryDto } from '@app/shared/utils';
import { EmployeeGroupService } from '../services/employee-group.service';
import { UserContext } from '../../../shared/interfaces';
import { CreateEmployeeGroupDto, EmployeeGroupDto, EmployeeGroupQueryDto, UpdateEmployeeGroupDto } from '../dto';
import { ApiCrudOperation } from '../../../shared/utils';
import { Scope } from '../../../shared/decorators';
import { User as CurrentUser } from '@app/shared/auth';

@ApiTags('Employee Groups')
@Controller('employee/groups')
@ApiBearerAuth()
@ApiExtraModels(EmployeeGroupDto)
@Roles(Role.ADMIN, Role.HR)
export class EmployeeGroupController {
    constructor(private readonly employeeGroupService: EmployeeGroupService) {}

    @Get()
    @ApiCrudOperation(EmployeeGroupDto, 'list', {
        summary: 'Get all employee groups with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: {
                name: String,
                isDefault: Boolean,
                isActive: Boolean,
                organizationId: Number,
            },
        },
    })
    async findAll(
        @Query() query: EmployeeGroupQueryDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.employeeGroupService.findAll(query, scope, user);
    }

    @Get(':id')
    @ApiCrudOperation(EmployeeGroupDto, 'get', { 
        summary: 'Get employee group by ID - Returns detailed information including employees and policy'
    })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.employeeGroupService.findOne(id, scope, user);
    }

    @Post()
    @ApiCrudOperation(EmployeeGroupDto, 'create', {
        body: CreateEmployeeGroupDto,
        summary: 'Create new employee group - If marked as default, unsets other defaults'
    })
    async create(
        @Body() createEmployeeGroupDto: CreateEmployeeGroupDto,
        @Scope() scope: DataScope
    ) {
        return await this.employeeGroupService.create(createEmployeeGroupDto, scope);
    }

    @Put(':id')
    @ApiCrudOperation(EmployeeGroupDto, 'update', {
        body: UpdateEmployeeGroupDto,
        summary: 'Update existing employee group',
        errorResponses: { notFound: true, forbidden: true, conflict: true },
    })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateEmployeeGroupDto: UpdateEmployeeGroupDto,
        @CurrentUser() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return await this.employeeGroupService.update(id, updateEmployeeGroupDto, scope, user);
    }

    @Delete(':id')
    @ApiCrudOperation(null, 'delete', {
        summary: 'Delete employee group - Cannot delete if has employees or is default',
        errorResponses: { notFound: true, forbidden: true, badRequest: true },
    })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        await this.employeeGroupService.remove(id, scope, user);
        return { message: 'Employee group deleted successfully' };
    }

    @Post(':id/set-default')
    @ApiCrudOperation(EmployeeGroupDto, 'update', {
        summary: 'Set employee group as default - Unsets all other defaults',
        errorResponses: { notFound: true, forbidden: true },
    })
    async setAsDefault(
        @Param('id', ParseIntPipe) id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        return await this.employeeGroupService.setAsDefault(id, scope, user);
    }

    @Get(':id/employees-count')
    @ApiCrudOperation(null, 'get', {
        summary: 'Get count of employees in group',
        errorResponses: { notFound: true, forbidden: true },
    })
    async getEmployeesCount(
        @Param('id', ParseIntPipe) id: number,
        @Scope() scope: DataScope,
        @CurrentUser() user: UserContext
    ) {
        return await this.employeeGroupService.getEmployeesCount(id, scope, user);
    }
}
