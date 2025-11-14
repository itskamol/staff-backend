import { Body, Controller, Get, Param, Post, Put, Delete, Query } from '@nestjs/common';
import { EmployeePlanService } from './employee-plan.service';
import { AssignEmployeesDto, CreateEmployeePlanDto, EmployeePlanQueryDto, UpdateEmployeePlanDto } from './employee-plan.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataScope, Role, Roles, Scope, User, UserContext } from '@app/shared/auth';

@ApiTags('Schedule')
@Controller('employee-plans')
@ApiBearerAuth()
export class EmployeePlanController {
    constructor(private readonly service: EmployeePlanService) { }


    @Post()
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Create employee plan' })
    @ApiResponse({ status: 201, description: 'Employee plan created' })
    async create(
        @Body() dto: CreateEmployeePlanDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.service.create(dto, user, scope);
    }

    @Get()
    @ApiOperation({ summary: 'Get all employee plans with filter, sort and pagination' })
    @ApiResponse({ status: 200, description: 'List of employee plans' })
    async findAll(@Query() query: EmployeePlanQueryDto) {
        return this.service.findAll(query);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get employee plan by id' })
    @ApiResponse({ status: 200, description: 'Employee plan data' })
    async findById(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update employee plan' })
    @ApiResponse({ status: 200, description: 'Updated employee plan' })
    async update(@Param('id') id: string, @Body() dto: UpdateEmployeePlanDto) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete employee plan' })
    @ApiResponse({ status: 200, description: 'Employee plan deleted' })
    async delete(@Param('id') id: string) {
        return this.service.delete(id);
    }

    @Post('assign')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Assign employee plan to employees' })
    @ApiResponse({ status: 200, description: 'Employees assigned to plan' })
    async assignEmployees(
        @Body() dto: AssignEmployeesDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.service.assignEmployees(dto,scope, user);
    }
}
