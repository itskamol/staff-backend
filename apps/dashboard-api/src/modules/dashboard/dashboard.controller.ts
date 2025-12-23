import { Body, Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User, Scope, DataScope } from '@app/shared/auth';

import { UserContext } from '../../shared/interfaces';
import { DashboardService } from './dashboard.service';
import { ChartStatsQueryDto } from './dto/dashboard.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get()
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Get dashboard stats' })
    @ApiResponse({
        status: 200,
        description: 'Dashbaord stats retrieved successfully',
    })
    async getAttendanceReport(@User() user: UserContext, @Scope() scope: DataScope) {
        return this.dashboardService.generateAttendanceReport(user, scope);
    }

    @Get('chart')
    @Roles(Role.ADMIN, Role.HR)
    @ApiOperation({ summary: 'Get dashboard chart stats' })
    @ApiResponse({
        status: 200,
        description: 'Dashbaord Chart stats retrieved successfully',
    })
    async getAttendanceChart(
        @Query() query: ChartStatsQueryDto,
        @User() user: UserContext,
        @Scope() scope: DataScope
    ) {
        return this.dashboardService.generateChartStats(query, user, scope);
    }
}
