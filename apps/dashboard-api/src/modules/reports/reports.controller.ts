import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ReportsService } from './reports.service';
import {
    AttendanceReportByEmployeeDto,
    AttendanceReportData,
    AttendanceReportDto,
} from './dto/reports.dto';
import { UserContext } from '../../shared/interfaces';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Get('attendance')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get attendance report' })
    @ApiResponse({
        status: 200,
        description: 'Attendance report retrieved successfully',
    })
    async getAttendanceReport(
        @Query() attendanceReportDto: AttendanceReportDto,
        @CurrentUser() user: UserContext
    ) {
        const report = await this.reportsService.generateAttendanceReport(
            attendanceReportDto,
            user
        );
        return report;
    }

    @Get('attendance/statics')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get attendance stats by employee' })
    @ApiResponse({
        status: 200,
        description: 'Attendance report retrieved successfully',
    })
    async getAttendanceStatics(
        @Query() attendanceReportDto: AttendanceReportByEmployeeDto,
        @CurrentUser() user: UserContext
    ) {
        const report = await this.reportsService.getAttendanceStats(attendanceReportDto, user);
        return report;
    }
}
