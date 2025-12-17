import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User, Scope, DataScope } from '@app/shared/auth';

import { UserContext } from '../../shared/interfaces';
import { DashboardService } from './dashboard.service';

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
}
