import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DataScope, Roles, Scope, User, UserContext } from '@app/shared/auth';
import { Role } from '@prisma/client';

import { JobService } from '../service/job.service';
import { CreateJobDto, JobQueryDto, JobResponseDto, UpdateJobDto } from '../dto/job.dto';

@ApiTags('Jobs')
@ApiBearerAuth()
@Controller('jobs')
@Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
export class JobController {
    constructor(private readonly jobService: JobService) {}

    @Post()
    @ApiOperation({ summary: 'Create a new Job' })
    @ApiResponse({ status: 201, type: JobResponseDto })
    async create(@Body() dto: CreateJobDto, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.jobService.createJob(dto, scope, user);
    }

    @Get()
    @ApiOperation({ summary: 'Get all Jobs with filters and pagination' })
    @ApiResponse({ status: 200, type: [JobResponseDto] })
    async getAll(
        @Query() query: JobQueryDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.jobService.getAllJobs(query, scope, user);
    }

    @Get(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Get a Job by ID' })
    @ApiResponse({ status: 200, type: JobResponseDto })
    async getById(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.jobService.getJobById(id, scope, user);
    }

    @Put(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Update an existing Job' })
    @ApiResponse({ status: 200, type: JobResponseDto })
    async update(
        @Param('id') id: number,
        @Body() dto: UpdateJobDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.jobService.updateJob(id, dto, scope, user);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', type: Number })
    @ApiOperation({ summary: 'Delete a Job by ID' })
    @ApiResponse({ status: 200, description: 'Job successfully deleted' })
    async delete(@Param('id') id: number, @User() user: UserContext, @Scope() scope: DataScope) {
        return this.jobService.deleteJob(id, scope, user);
    }
}
