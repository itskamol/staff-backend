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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get all departments' })
    @ApiResponse({ status: 200, description: 'Departments retrieved successfully' })
    async findAll(
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.departmentService.findAll(paginationDto, user);
        return ApiResponseDto.success(result, 'Departments retrieved successfully');
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get department by ID' })
    @ApiResponse({ status: 200, description: 'Department retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Department not found' })
    async findOne(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const department = await this.departmentService.findOne(id, user);
        return ApiResponseDto.success(department, 'Department retrieved successfully');
    }

    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Create new department' })
    @ApiResponse({ status: 201, description: 'Department created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async create(
        @Body() createDepartmentDto: CreateDepartmentDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const department = await this.departmentService.create(createDepartmentDto, user);
        return ApiResponseDto.success(department, 'Department created successfully');
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Update department' })
    @ApiResponse({ status: 200, description: 'Department updated successfully' })
    @ApiResponse({ status: 404, description: 'Department not found' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateDepartmentDto: UpdateDepartmentDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const department = await this.departmentService.update(id, updateDepartmentDto, user);
        return ApiResponseDto.success(department, 'Department updated successfully');
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Delete department' })
    @ApiResponse({ status: 200, description: 'Department deleted successfully' })
    @ApiResponse({ status: 404, description: 'Department not found' })
    async remove(
        @Param('id', ParseIntPipe) id: number,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        await this.departmentService.remove(id, user);
        return ApiResponseDto.success(null, 'Department deleted successfully');
    }

    @Get(':id/sub-departments')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get department sub-departments' })
    @ApiResponse({ status: 200, description: 'Sub-departments retrieved successfully' })
    async getSubDepartments(
        @Param('id', ParseIntPipe) id: number,
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.departmentService.getSubDepartments(id, paginationDto, user);
        return ApiResponseDto.success(result, 'Sub-departments retrieved successfully');
    }

    @Get(':id/employees')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get department employees' })
    @ApiResponse({ status: 200, description: 'Employees retrieved successfully' })
    async getEmployees(
        @Param('id', ParseIntPipe) id: number,
        @Query() paginationDto: PaginationDto,
        @CurrentUser() user: any
    ): Promise<ApiResponseDto> {
        const result = await this.departmentService.getEmployees(id, paginationDto, user);
        return ApiResponseDto.success(result, 'Employees retrieved successfully');
    }
}
