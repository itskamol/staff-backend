import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { ReportsService } from './reports.service';
import {
    GenerateReportDto,
    AttendanceReportDto,
    ProductivityReportDto,
    DeviceUsageReportDto,
    ReportType,
} from './dto/reports.dto';
import { ApiCrudOperation } from '../../shared/utils';
import { UserContext } from '../../shared/interfaces';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Post('generate')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiCrudOperation(PaginationDto, 'create', {
        body: GenerateReportDto,
        summary: 'Generate a new report',
        errorResponses: { badRequest: true, forbidden: true },
    })
    async generateReport(
        @Body() generateReportDto: GenerateReportDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const report = await this.reportsService.generateReport(generateReportDto, user);
        return ApiResponseDto.success(report, 'Report generated successfully');
    }

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
    ): Promise<ApiResponseDto> {
        const report = await this.reportsService.generateAttendanceReport(
            attendanceReportDto,
            user
        );
        return ApiResponseDto.success(report, 'Attendance report retrieved successfully');
    }

    @Get('productivity')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get productivity report' })
    @ApiResponse({
        status: 200,
        description: 'Productivity report retrieved successfully',
    })
    async getProductivityReport(
        @Query() productivityReportDto: ProductivityReportDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const report = await this.reportsService.generateProductivityReport(
            productivityReportDto,
            user
        );
        return ApiResponseDto.success(report, 'Productivity report retrieved successfully');
    }

    @Get('device-usage')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get device usage report' })
    @ApiResponse({
        status: 200,
        description: 'Device usage report retrieved successfully',
    })
    async getDeviceUsageReport(
        @Query() deviceUsageReportDto: DeviceUsageReportDto,
        @CurrentUser() user: UserContext
    ): Promise<ApiResponseDto> {
        const report = await this.reportsService.generateDeviceUsageReport(
            deviceUsageReportDto,
            user
        );
        return ApiResponseDto.success(report, 'Device usage report retrieved successfully');
    }

    @Get('visitor-activity')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get visitor activity report' })
    @ApiResponse({
        status: 200,
        description: 'Visitor activity report retrieved successfully',
    })
    async getVisitorActivityReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @CurrentUser() user?: any
    ): Promise<ApiResponseDto> {
        const dateRange = {
            startDate: startDate
                ? new Date(startDate)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate: endDate ? new Date(endDate) : new Date(),
        };

        const report = await this.reportsService.generateVisitorActivityReport(dateRange, user);
        return ApiResponseDto.success(report, 'Visitor activity report retrieved successfully');
    }

    @Get('dashboard-summary')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get dashboard summary statistics' })
    @ApiResponse({
        status: 200,
        description: 'Dashboard summary retrieved successfully',
    })
    async getDashboardSummary(@CurrentUser() user: UserContext): Promise<ApiResponseDto> {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Generate multiple reports for dashboard
        const [attendanceReport, deviceUsageReport, visitorReport] = await Promise.all([
            this.reportsService.generateAttendanceReport(
                {
                    startDate: startOfMonth.toISOString(),
                    endDate: today.toISOString(),
                },
                user
            ),
            this.reportsService.generateDeviceUsageReport(
                {
                    startDate: startOfMonth.toISOString(),
                    endDate: today.toISOString(),
                },
                user
            ),
            this.reportsService.generateVisitorActivityReport(
                {
                    startDate: startOfMonth,
                    endDate: today,
                },
                user
            ),
        ]);

        const summary = {
            totalEmployees: attendanceReport.length,
            averageAttendance:
                attendanceReport.length > 0
                    ? attendanceReport.reduce((sum, emp) => sum + emp.attendancePercentage, 0) /
                      attendanceReport.length
                    : 0,
            totalDevices: deviceUsageReport.length,
            totalEntriesToday: deviceUsageReport.reduce(
                (sum, device) => sum + device.totalEntries,
                0
            ),
            totalVisitors: visitorReport.length,
            activeVisitorsToday: visitorReport.filter(visitor => {
                const lastVisit = new Date(visitor.lastVisitDate);
                return lastVisit.toDateString() === today.toDateString();
            }).length,
            monthlyStats: {
                attendance: attendanceReport,
                deviceUsage: deviceUsageReport,
                visitors: visitorReport,
            },
        };

        return ApiResponseDto.success(summary, 'Dashboard summary retrieved successfully');
    }

    @Get('export/:reportId')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Download exported report' })
    @ApiResponse({ status: 200, description: 'Report file downloaded' })
    async downloadReport(@Param('reportId') reportId: string, @CurrentUser() user: UserContext) {
        // TODO: Implement actual file download
        // This would serve the generated report files
        return {
            message: 'Report download functionality not implemented yet',
            reportId,
        };
    }

    @Get('templates')
    @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD)
    @ApiOperation({ summary: 'Get available report templates' })
    @ApiResponse({
        status: 200,
        description: 'Report templates retrieved successfully',
    })
    async getReportTemplates(): Promise<ApiResponseDto> {
        const templates = [
            {
                id: 'attendance-monthly',
                name: 'Monthly Attendance Report',
                description: 'Comprehensive monthly attendance report for all employees',
                type: ReportType.ATTENDANCE,
                parameters: ['startDate', 'endDate', 'departmentId'],
            },
            {
                id: 'productivity-weekly',
                name: 'Weekly Productivity Report',
                description: 'Weekly productivity analysis with application and website usage',
                type: ReportType.PRODUCTIVITY,
                parameters: ['startDate', 'endDate', 'employeeIds'],
            },
            {
                id: 'device-usage-daily',
                name: 'Daily Device Usage Report',
                description: 'Daily device usage statistics and peak hours analysis',
                type: ReportType.DEVICE_USAGE,
                parameters: ['startDate', 'endDate', 'gateIds'],
            },
            {
                id: 'visitor-activity-monthly',
                name: 'Monthly Visitor Activity Report',
                description: 'Monthly visitor activity and access patterns',
                type: ReportType.VISITOR_ACTIVITY,
                parameters: ['startDate', 'endDate'],
            },
            {
                id: 'security-events-weekly',
                name: 'Weekly Security Events Report',
                description: 'Security events and unauthorized access attempts',
                type: ReportType.SECURITY_EVENTS,
                parameters: ['startDate', 'endDate'],
            },
        ];

        return ApiResponseDto.success(templates, 'Report templates retrieved successfully');
    }
}
