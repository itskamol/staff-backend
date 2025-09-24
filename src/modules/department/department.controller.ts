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
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
} from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    CreateDepartmentDto,
    DepartmentResponseDto,
    UpdateDepartmentDto,
} from '@/shared/dto';
import { Roles, Scope } from '@/shared/decorators';
import { Prisma, Role } from '@prisma/client';
import { ApiOkResponseData, ApiOkResponsePaginated } from '@/shared/utils';
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
    @ApiOperation({ summary: 'Create a new department' })
    @ApiBody({ type: CreateDepartmentDto })
    @ApiResponse({
        status: 201,
        description: 'The department has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(DepartmentResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async createDepartment(@Body() dto: CreateDepartmentDto) {
        return this.departmentService.createDepartment(dto);
    }

    @Get()
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get all departments with pagination' })
    @ApiQuery({
        name: 'search',
        description: 'Search term (at least 2 characters)',
        minLength: 2,
        required: false,
    })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({ name: 'sort', required: false, type: String, enum: Prisma.DepartmentScalarFieldEnum })
    @ApiQuery({ name: 'order', required: false, type: String, enum: ['asc', 'desc'] })
    @ApiOkResponsePaginated(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    async getAllDepartments(
        @Query() query: QueryDto,
        @Scope() scope: DataScope
    ) {
        return this.departmentService.getDepartments(query, scope);
    }

    @Get(':id')
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get a department by ID' })
    @ApiOkResponseData(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async getDepartmentById(@Param('id') id: number, @Scope() scope: DataScope) {
        const department = await this.departmentService.getDepartmentById(id, scope);
        if (!department) {
            throw new NotFoundException('Department not found.');
        }
        return department;
    }

    @Get('self')
    @ApiOperation({ summary: 'Get the current authenticated user\'s department' })
    @ApiOkResponseData(DepartmentResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
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
    @ApiOperation({ summary: 'Update a department by ID' })
    @ApiBody({ type: UpdateDepartmentDto })
    @ApiResponse({
        status: 200,
        description: 'The department has been successfully updated.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(DepartmentResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async updateDepartment(
        @Param('id') id: number,
        @Body() dto: UpdateDepartmentDto,
        @Scope() scope: DataScope
    ) {
        return this.departmentService.updateDepartment(id, dto, scope);
    }

    @Delete(':id')
    @Roles(Role.ADMIN, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Delete a department by ID' })
    @ApiResponse({
        status: 200,
        description: 'The department has been successfully deleted.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    example: 'Department deleted successfully.',
                                },
                            },
                        },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'Department not found.', type: ApiErrorResponse })
    async deleteDepartment(@Param('id') id: number, @Scope() scope: DataScope) {
        await this.departmentService.deleteDepartment(id, scope);
        return { message: 'Department deleted successfully.' };
    }
}