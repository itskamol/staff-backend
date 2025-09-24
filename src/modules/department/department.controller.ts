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
import {
    ApiSuccessResponse,
    CreateDepartmentDto,
    DepartmentResponseDto,
    UpdateDepartmentDto,
} from '@/shared/dto';
import { Roles, Scope } from '@/shared/decorators';
import { Role } from '@prisma/client';
import { ApiOkResponseData, ApiCrudOperation, ApiErrorResponses } from '@/shared/utils';
import { DataScope } from '@/shared/interfaces';
import { QueryDto } from '@/shared/dto/query.dto';

@ApiTags('Departments')
@ApiBearerAuth()
@Controller('departments')
@ApiExtraModels(ApiSuccessResponse, DepartmentResponseDto)
export class DepartmentController {
    constructor(private readonly departmentService: DepartmentService) {}

    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
    @Post()
    @ApiCrudOperation(DepartmentResponseDto, 'create', {
        body: CreateDepartmentDto,
        summary: 'Create a new department',
    })
    async createDepartment(@Body() dto: CreateDepartmentDto) {
        return this.departmentService.createDepartment(dto);
    }

    @Get()
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
    @ApiCrudOperation(DepartmentResponseDto, 'list', {
        summary: 'Get all departments with pagination',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: ['isActive'],
        },
    })
    async getAllDepartments(@Query() query: QueryDto, @Scope() scope: DataScope) {
        return this.departmentService.getDepartments(query, scope);
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
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

    @Get('self')
    @ApiOkResponseData(DepartmentResponseDto, {
        summary: "Get the current authenticated user's department",
    })
    @ApiErrorResponses({ forbidden: true, notFound: true })
    async getCurrentDepartment(@Scope() scope: DataScope) {
        if (!scope.departmentId) {
            throw new NotFoundException('User has no department assigned.');
        }
        const department = await this.departmentService.getDepartmentById(
            scope.departmentId,
            scope
        );
        if (!department) {
            throw new NotFoundException('Department not found.');
        }
        return department;
    }

    @Put(':id')
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
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
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
    @ApiCrudOperation(DepartmentResponseDto, 'delete', {
        summary: 'Delete a department by ID',
    })
    async deleteDepartment(@Param('id') id: number, @Scope() scope: DataScope) {
        await this.departmentService.deleteDepartment(id, scope);
        return { message: 'Department deleted successfully.' };
    }
}
