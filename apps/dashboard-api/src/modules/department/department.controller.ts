import {
    Body,
    Controller,
    Delete,
    Get,
    NotFoundException,
    Param,
    Put,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import { DataScope, Role, Roles } from '@app/shared/auth';
import { ApiSuccessResponse } from '../../shared/dto';
import { CreateDepartmentDto, DepartmentQueryDto, DepartmentResponseDto, UpdateDepartmentDto } from './dto';
import { ApiCrudOperation, ApiOkResponseData } from '../../shared/utils';
import { Scope } from '../../shared/decorators';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@Roles(Role.ADMIN, Role.DEPARTMENT_LEAD, Role.HR)
@ApiExtraModels(ApiSuccessResponse, DepartmentResponseDto)
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Post()
    @ApiCrudOperation(DepartmentResponseDto, 'create', {
        body: CreateDepartmentDto,
        summary: 'Create a new department',
    })
    async createDepartment(@Body() dto: CreateDepartmentDto, @Scope() scope: DataScope) {
        return this.departmentService.createDepartment(dto, scope);
    }

    @Get()
    @ApiCrudOperation(DepartmentResponseDto, 'list', {
        summary: 'Get all departments with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: { isActive: Boolean, organizationId: Number },
        },
    })
    async getAllDepartments(@Query() query: DepartmentQueryDto, @Scope() scope: DataScope) {
        return this.departmentService.getDepartments(query, scope);
    }

    @Get('self')
    @ApiOkResponseData(DepartmentResponseDto, {
        summary: "Get the current authenticated user's department",
    })
    async getCurrentDepartment(@Scope() scope: DataScope) {
        return this.departmentService.getDepartmentsWithScope(scope);
    }

    @Get(':id')
    @ApiCrudOperation(DepartmentResponseDto, 'get', {
        summary: 'Get a department by ID',
    })
    async getDepartmentById(@Param('id') id: number, @Scope() scope: DataScope) {
        const department = await this.departmentService.getDepartmentById(id, scope);
        if (!department) {
            throw new NotFoundException('Department not found.');
        }
        return department;
    }

    @Put(':id')
    @ApiCrudOperation(DepartmentResponseDto, 'update', {
        body: UpdateDepartmentDto,
        summary: 'Update a department by ID',
    })
    async updateDepartment(
        @Param('id') id: number,
        @Body() dto: UpdateDepartmentDto,
        @Scope() scope: DataScope
    ) {
        return this.departmentService.updateDepartment(id, dto, scope);
    }

    @Delete(':id')
    @ApiCrudOperation(DepartmentResponseDto, 'delete', {
        summary: 'Delete a department by ID',
    })
    async deleteDepartment(@Param('id') id: number, @Scope() scope: DataScope) {
        await this.departmentService.deleteDepartment(id, scope);
        return { message: 'Department deleted successfully.' };
    }
}
