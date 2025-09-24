import {
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiExtraModels,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import {
    ApiSuccessResponse,
    CreateEmployeeDto,
    EmployeeResponseDto,
    UpdateEmployeeDto,
    AssignCardDto,
    AssignCarDto,
    LinkComputerUserDto,
    EntryLogResponseDto,
    ActivityReportResponseDto,
    ComputerUserResponseDto,
} from '@/shared/dto';
import { Roles, Scope, User } from '@/shared/decorators';
import { Role } from '@prisma/client';
import { ApiCrudOperation, ApiOkResponseData, ApiErrorResponses } from '@/shared/utils';
import { DataScope, UserContext } from '@/shared/interfaces';
import { QueryDto } from '@/shared/dto/query.dto';

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
@ApiExtraModels(ApiSuccessResponse, EmployeeResponseDto)
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiCrudOperation(EmployeeResponseDto, 'list', {
        summary: 'Get all employees',
        includeQueries: { 
            pagination: true, 
            search: true, 
            sort: true, 
            filters: ['isActive', 'departmentId'] 
        }
    })
    async getAllEmployees(
        @Query() query: QueryDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.getEmployees(query, scope, user);
    }

    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiCrudOperation(EmployeeResponseDto, 'create', {
        body: CreateEmployeeDto,
        summary: 'Create a new employee'
    })
    async createEmployee(
        @Body() dto: CreateEmployeeDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.createEmployee(dto, scope, user);
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiCrudOperation(EmployeeResponseDto, 'update', {
        body: UpdateEmployeeDto,
        summary: 'Update an employee'
    })
    async updateEmployee(
        @Param('id') id: number,
        @Body() dto: UpdateEmployeeDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.updateEmployee(id, dto, scope, user);
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiCrudOperation(EmployeeResponseDto, 'delete', {
        summary: 'Delete an employee'
    })
    async deleteEmployee(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        await this.employeeService.deleteEmployee(id, scope, user);
        return { message: 'Employee deleted successfully.' };
    }

    @Get(':id/entry-logs')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiOkResponseData(EntryLogResponseDto, {
        summary: 'Get employee entry logs'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true })
    async getEmployeeEntryLogs(
        @Param('id') id: number,
        @Query() query: QueryDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.getEmployeeEntryLogs(id, query, scope, user);
    }

    @Get(':id/activity-report')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiOkResponseData(ActivityReportResponseDto, {
        summary: 'Get employee activity report'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true })
    async getEmployeeActivityReport(
        @Param('id') id: number,
        @Query() query: QueryDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.getEmployeeActivityReport(id, query, scope, user);
    }

    @Get(':id/computer-users')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiOkResponseData(ComputerUserResponseDto, {
        summary: 'Get employee computer users'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true })
    async getEmployeeComputerUsers(
        @Param('id') id: number,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.getEmployeeComputerUsers(id, scope, user);
    }

    @Post(':id/assign-card')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiOkResponseData(Object, {
        summary: 'Assign card to employee'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true, badRequest: true })
    async assignCardToEmployee(
        @Param('id') id: number,
        @Body() dto: AssignCardDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.assignCardToEmployee(id, dto, scope, user);
    }

    @Post(':id/assign-car')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiOkResponseData(Object, {
        summary: 'Assign car to employee'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true, badRequest: true })
    async assignCarToEmployee(
        @Param('id') id: number,
        @Body() dto: AssignCarDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.assignCarToEmployee(id, dto, scope, user);
    }

    @Post(':id/link-computer-user')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiOkResponseData(Object, {
        summary: 'Link computer user to employee'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true, badRequest: true })
    async linkComputerUserToEmployee(
        @Param('id') id: number,
        @Body() dto: LinkComputerUserDto,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        return this.employeeService.linkComputerUserToEmployee(id, dto, scope, user);
    }

    @Delete(':id/unlink-computer-user/:computer_user_id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiParam({ name: 'id', description: 'Employee ID' })
    @ApiParam({ name: 'computer_user_id', description: 'Computer User ID' })
    @ApiOkResponseData(Object, {
        summary: 'Unlink computer user from employee'
    })
    @ApiErrorResponses({ forbidden: true, notFound: true })
    async unlinkComputerUserFromEmployee(
        @Param('id') id: number,
        @Param('computer_user_id') computerUserId: number,
        @Scope() scope: DataScope,
        @User() user: UserContext
    ) {
        await this.employeeService.unlinkComputerUserFromEmployee(id, computerUserId, scope, user);
        return { message: 'Computer user unlinked successfully.' };
    }
}