import { Body, Controller, Get, Param, Post, Put, Delete, Query, ParseIntPipe } from '@nestjs/common';
import { EmployeePlanService } from './employee-plan.service';
import { AssignEmployeesDto, CreateEmployeePlanDto, EmployeePlanQueryDto, UpdateEmployeePlanDto } from './employee-plan.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataScope, Role, Roles, Scope, User, UserContext } from '@app/shared/auth';

@ApiTags('Schedule')
@Controller('employee-plans')
@Roles(Role.ADMIN, Role.DEPARTMENT_LEAD, Role.HR)
@ApiBearerAuth()
export class EmployeePlanController {
    constructor(private readonly service: EmployeePlanService) { }


    @Post()
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
    async findAll(
        @Query() query: EmployeePlanQueryDto,
        @Scope() scope: DataScope
    ) {
        return this.service.findAll(query,scope);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get employee plan by id' })
    @ApiResponse({ status: 200, description: 'Employee plan data' })
    async findById(
        @Param('id', ParseIntPipe) id: number,
        @Scope() scope: DataScope
        
    ) {
        return this.service.findById(id, scope);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update employee plan' })
    @ApiResponse({ status: 200, description: 'Updated employee plan' })
    async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmployeePlanDto, @Scope() scope: DataScope) {
        return this.service.update(id, dto, scope);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete employee plan' })
    @ApiResponse({ status: 200, description: 'Employee plan deleted' })
    async delete(@Param('id', ParseIntPipe) id: number, @Scope() scope: DataScope) {
        return this.service.delete(id,scope);
    }

    @Post('assign')
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
