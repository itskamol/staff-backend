import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto, UpdateEmployeeDto, LinkComputerUserDto } from './dto/employee.dto';

@ApiTags('Employees')
@Controller('employees')
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiOperation({ summary: 'Get all employees' })
    @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
    async findAll(
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.employeeService.findAll(paginationDto, user);
        return ApiResponseDto.success(result, 'Employees retrieved successfully');
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiOperation({ summary: 'Get employee by ID' })
    @ApiResponse({ status: 200, description: 'Employee retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Employee not found' })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const employee = await this.employeeService.findOne(id, user);
        return ApiResponseDto.success(employee, 'Employee retrieved successfully');
    }

    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Create new employee' })
    @ApiResponse({ status: 201, description: 'Employee created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async create(
        @Body() createEmployeeDto: CreateEmployeeDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const employee = await this.employeeService.create(createEmployeeDto, user);
        return ApiResponseDto.success(employee, 'Employee created successfully');
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Update employee' })
    @ApiResponse({ status: 200, description: 'Employee updated successfully' })
    @ApiResponse({ status: 404, description: 'Employee not found' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateEmployeeDto: UpdateEmployeeDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const employee = await this.employeeService.update(id, updateEmployeeDto, user);
        return ApiResponseDto.success(employee, 'Employee updated successfully');
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Delete employee' })
    @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
    @ApiResponse({ status: 404, description: 'Employee not found' })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        await this.employeeService.remove(id, user);
        return ApiResponseDto.success(null, 'Employee deleted successfully');
    }

    @Get(':id/computer-users')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get employee computer users' })
    @ApiResponse({ status: 200, description: 'Computer users retrieved successfully' })
    async getComputerUsers(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.employeeService.getComputerUsers(id, user);
        return ApiResponseDto.success(result, 'Computer users retrieved successfully');
    }

    @Post(':id/link-computer-user')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Link employee to computer user' })
    @ApiResponse({ status: 200, description: 'Computer user linked successfully' })
    async linkComputerUser(
        @Param('id', ParseIntPipe) id: number,
        @Body() linkDto: LinkComputerUserDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.employeeService.linkComputerUser(id, linkDto, user);
        return ApiResponseDto.success(result, 'Computer user linked successfully');
    }

    @Delete(':id/unlink-computer-user/:computerUserId')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Unlink employee from computer user' })
    @ApiResponse({ status: 200, description: 'Computer user unlinked successfully' })
    async unlinkComputerUser(
        @Param('id', ParseIntPipe) id: number,
        @Param('computerUserId', ParseIntPipe) computerUserId: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        await this.employeeService.unlinkComputerUser(id, computerUserId, user);
        return ApiResponseDto.success(null, 'Computer user unlinked successfully');
    }

    @Get(':id/entry-logs')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
    @ApiOperation({ summary: 'Get employee entry logs' })
    @ApiResponse({ status: 200, description: 'Entry logs retrieved successfully' })
    async getEntryLogs(
        @Param('id', ParseIntPipe) id: number,
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.employeeService.getEntryLogs(id, paginationDto, user);
        return ApiResponseDto.success(result, 'Entry logs retrieved successfully');
    }

    @Get(':id/activity-report')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get employee activity report' })
    @ApiResponse({ status: 200, description: 'Activity report retrieved successfully' })
    async getActivityReport(
        @Param('id', ParseIntPipe) id: number,
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.employeeService.getActivityReport(id, paginationDto, user);
        return ApiResponseDto.success(result, 'Activity report retrieved successfully');
    }
}
