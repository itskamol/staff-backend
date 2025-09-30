import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import {
    GenerateReportDto,
    AttendanceReportDto,
    ProductivityReportDto,
    DeviceUsageReportDto,
    ReportType,
    TimeRange,
    ExportFormat,
    AttendanceReportData,
    ProductivityReportData,
    DeviceUsageReportData,
    VisitorActivityReportData,
} from './dto/reports.dto';
import { UserContext } from '../../shared/interfaces';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async generateReport(generateReportDto: GenerateReportDto, user: UserContext) {
        const {
            reportType,
            timeRange,
            startDate,
            endDate,
            departmentIds,
            employeeIds,
            exportFormat,
        } = generateReportDto;

        // Calculate date range
        const dateRange = this.calculateDateRange(timeRange, startDate, endDate);

        // Apply role-based filtering
        const filteredParams = await this.applyRoleBasedFiltering(
            { departmentIds, employeeIds },
            user
        );

        let reportData: any;

        switch (reportType) {
            case ReportType.ATTENDANCE:
                reportData = await this.generateAttendanceReport(
                    {
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                        departmentId: filteredParams.departmentIds?.[0],
                    },
                    user
                );
                break;

            case ReportType.PRODUCTIVITY:
                reportData = await this.generateProductivityReport(
                    {
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                        employeeIds: filteredParams.employeeIds,
                    },
                    user
                );
                break;

            case ReportType.DEVICE_USAGE:
                reportData = await this.generateDeviceUsageReport(
                    {
                        startDate: dateRange.startDate,
                        endDate: dateRange.endDate,
                    },
                    user
                );
                break;

            case ReportType.VISITOR_ACTIVITY:
                reportData = await this.generateVisitorActivityReport(dateRange, user);
                break;

            case ReportType.SECURITY_EVENTS:
                reportData = await this.generateSecurityEventsReport(dateRange, user);
                break;

            default:
                throw new BadRequestException('Invalid report type');
        }

        // Export if format is specified
        if (exportFormat) {
            return await this.exportReport(reportData, reportType, exportFormat);
        }

        return {
            reportType,
            timeRange: dateRange,
            data: reportData,
            generatedAt: new Date(),
            generatedBy: +user.sub,
        };
    }

    async generateAttendanceReport(
        dto: AttendanceReportDto,
        user: UserContext
    ): Promise<AttendanceReportData[]> {
        const { startDate, endDate, departmentId } = dto;

        // Build where clause based on user role
        const whereClause: any = {};

        if (user.role === Role.HR) {
            whereClause.employee = {
                department: {
                    organizationId: user.organizationId,
                },
            };
        } else if (user.role === Role.DEPARTMENT_LEAD) {
            whereClause.employee = {
                department: {
                    id: { in: user.departmentIds || [] },
                },
            };
        }

        if (departmentId) {
            whereClause.employee = {
                ...whereClause.employee,
                departmentId,
            };
        }

        if (startDate && endDate) {
            whereClause.actionTime = {
                gte: new Date(startDate),
                lte: new Date(endDate),
            };
        }

        // Get attendance data from actions table
        const attendanceData = await this.prisma.action.groupBy({
            by: ['employeeId'],
            where: {
                ...whereClause,
                employeeId: { not: null },
                entryType: 'ENTER',
            },
            _count: {
                id: true,
            },
        });

        // Get employee details and calculate attendance metrics
        const reportData: AttendanceReportData[] = [];

        for (const attendance of attendanceData) {
            if (!attendance.employeeId) continue;

            const employee = await this.prisma.employee.findUnique({
                where: { id: attendance.employeeId },
                include: {
                    department: {
                        select: {
                            fullName: true,
                        },
                    },
                },
            });

            if (!employee) continue;

            // Calculate working days in the period
            const totalWorkingDays = this.calculateWorkingDays(
                new Date(startDate || '2024-01-01'),
                new Date(endDate || new Date())
            );

            // Get detailed attendance records for this employee
            const employeeActions = await this.prisma.action.findMany({
                where: {
                    employeeId: attendance.employeeId,
                    actionTime: {
                        gte: new Date(startDate || '2024-01-01'),
                        lte: new Date(endDate || new Date()),
                    },
                },
                orderBy: { actionTime: 'asc' },
            });

            const presentDays = new Set(
                employeeActions
                    .filter(action => action.entryType === 'ENTER')
                    .map(action => action.actionTime.toDateString())
            ).size;

            const absentDays = totalWorkingDays - presentDays;
            const attendancePercentage =
                totalWorkingDays > 0 ? (presentDays / totalWorkingDays) * 100 : 0;

            reportData.push({
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department.fullName,
                totalWorkingDays,
                presentDays,
                absentDays,
                lateArrivals: 0, // TODO: Calculate based on work schedule
                earlyDepartures: 0, // TODO: Calculate based on work schedule
                totalWorkingHours: 0, // TODO: Calculate from entry/exit pairs
                averageWorkingHours: 0, // TODO: Calculate average
                attendancePercentage: Math.round(attendancePercentage * 100) / 100,
            });
        }

        return reportData;
    }

    async generateProductivityReport(
        dto: ProductivityReportDto,
        user: UserContext
    ): Promise<ProductivityReportData[]> {
        const { startDate, endDate, employeeIds } = dto;

        // Build employee filter based on role
        let employeeFilter: any = {};

        if (user.role === Role.HR) {
            employeeFilter.department = {
                organizationId: user.organizationId,
            };
        } else if (user.role === Role.DEPARTMENT_LEAD) {
            employeeFilter.departmentId = { in: user.departmentIds || [] };
        }

        if (employeeIds && employeeIds.length > 0) {
            employeeFilter.id = { in: employeeIds };
        }

        const employees = await this.prisma.employee.findMany({
            where: employeeFilter,
            include: {
                department: {
                    select: {
                        fullName: true,
                    },
                },
                computerUsers: {
                    include: {
                        usersOnComputers: {
                            include: {
                                activeWindows: {
                                    where: {
                                        datetime: {
                                            gte: new Date(startDate || '2024-01-01'),
                                            lte: new Date(endDate || new Date()),
                                        },
                                    },
                                },
                                visitedSites: {
                                    where: {
                                        datetime: {
                                            gte: new Date(startDate || '2024-01-01'),
                                            lte: new Date(endDate || new Date()),
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const reportData: ProductivityReportData[] = [];

        for (const employee of employees) {
            let totalActiveTime = 0;
            let productiveTime = 0;
            let unproductiveTime = 0;
            const applicationUsage = new Map<string, number>();
            const websiteUsage = new Map<string, number>();

            // Process computer usage data
            for (const computerUser of employee.computerUsers) {
                for (const userOnComputer of computerUser.usersOnComputers) {
                    // Process active windows
                    for (const window of userOnComputer.activeWindows) {
                        totalActiveTime += window.activeTime;

                        // TODO: Implement productivity classification logic
                        // For now, assume all time is productive
                        productiveTime += window.activeTime;

                        const appName = window.processName;
                        applicationUsage.set(
                            appName,
                            (applicationUsage.get(appName) || 0) + window.activeTime
                        );
                    }

                    // Process visited sites
                    for (const site of userOnComputer.visitedSites) {
                        totalActiveTime += site.activeTime;

                        // TODO: Implement productivity classification logic
                        productiveTime += site.activeTime;

                        const url = new URL(site.url).hostname;
                        websiteUsage.set(url, (websiteUsage.get(url) || 0) + site.activeTime);
                    }
                }
            }

            const idleTime = 0; // TODO: Calculate idle time
            const productivityPercentage =
                totalActiveTime > 0 ? (productiveTime / totalActiveTime) * 100 : 0;

            // Get top applications
            const topApplications = Array.from(applicationUsage.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, timeSpent]) => ({
                    name,
                    timeSpent,
                    percentage: totalActiveTime > 0 ? (timeSpent / totalActiveTime) * 100 : 0,
                }));

            // Get top websites
            const topWebsites = Array.from(websiteUsage.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([url, timeSpent]) => ({
                    url,
                    timeSpent,
                    percentage: totalActiveTime > 0 ? (timeSpent / totalActiveTime) * 100 : 0,
                }));

            reportData.push({
                employeeId: employee.id,
                employeeName: employee.name,
                department: employee.department.fullName,
                totalActiveTime,
                productiveTime,
                unproductiveTime,
                idleTime,
                productivityPercentage: Math.round(productivityPercentage * 100) / 100,
                topApplications,
                topWebsites,
            });
        }

        return reportData;
    }

    async generateDeviceUsageReport(
        dto: DeviceUsageReportDto,
        user: UserContext
    ): Promise<DeviceUsageReportData[]> {
        const { startDate, endDate, gateIds } = dto;

        // Build where clause
        const whereClause: any = {
            actionTime: {
                gte: new Date(startDate || '2024-01-01'),
                lte: new Date(endDate || new Date()),
            },
        };

        if (gateIds && gateIds.length > 0) {
            whereClause.gateId = { in: gateIds };
        }

        // Get device usage data
        const devices = await this.prisma.device.findMany({
            where: gateIds ? { gateId: { in: gateIds } } : {},
            include: {
                gate: {
                    select: {
                        name: true,
                    },
                },
                actions: {
                    where: whereClause,
                },
            },
        });

        const reportData: DeviceUsageReportData[] = [];

        for (const device of devices) {
            const entries = device.actions.filter(action => action.entryType === 'ENTER');
            const exits = device.actions.filter(action => action.entryType === 'EXIT');

            // Calculate usage by hour
            const usageByHour = Array.from({ length: 24 }, (_, hour) => ({
                hour,
                entries: entries.filter(action => action.actionTime.getHours() === hour).length,
                exits: exits.filter(action => action.actionTime.getHours() === hour).length,
            }));

            // Find peak usage hour
            const peakHour = usageByHour.reduce((max, current) =>
                current.entries + current.exits > max.entries + max.exits ? current : max
            );

            // Calculate days in period
            const daysDiff = Math.ceil(
                (new Date(endDate || new Date()).getTime() -
                    new Date(startDate || '2024-01-01').getTime()) /
                    (1000 * 60 * 60 * 24)
            );

            reportData.push({
                deviceId: device.id,
                deviceName: device.name,
                gateName: device.gate.name,
                totalEntries: entries.length,
                totalExits: exits.length,
                peakUsageHour: `${peakHour.hour}:00`,
                averageEntriesPerDay: daysDiff > 0 ? Math.round(entries.length / daysDiff) : 0,
                mostActiveDay: 'Monday', // TODO: Calculate actual most active day
                usageByHour,
            });
        }

        return reportData;
    }

    async generateVisitorActivityReport(
        dateRange: any,
        user: UserContext
    ): Promise<VisitorActivityReportData[]> {
        // Build where clause based on user role
        const whereClause: any = {
            createdAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
            },
        };

        if (user.role === Role.HR) {
            whereClause.creator = {
                organizationId: user.organizationId,
            };
        } else if (user.role === Role.DEPARTMENT_LEAD) {
            whereClause.creator = {
                departmentUsers: {
                    some: {
                        departmentId: { in: user.departmentIds || [] },
                    },
                },
            };
        }

        const visitors = await this.prisma.visitor.findMany({
            where: whereClause,
            include: {
                creator: {
                    include: {
                        organization: {
                            select: {
                                fullName: true,
                            },
                        },
                    },
                },
                actions: {
                    where: {
                        actionTime: {
                            gte: dateRange.startDate,
                            lte: dateRange.endDate,
                        },
                    },
                },
            },
        });

        const reportData: VisitorActivityReportData[] = visitors.map(visitor => {
            const visits = visitor.actions.filter(action => action.entryType === 'ENTER');
            const lastVisit =
                visits.length > 0
                    ? visits.reduce((latest, current) =>
                          current.actionTime > latest.actionTime ? current : latest
                      )
                    : null;

            return {
                visitorId: visitor.id,
                visitorName: `${visitor.firstName} ${visitor.lastName}`,
                totalVisits: visits.length,
                totalDuration: 0, // TODO: Calculate from entry/exit pairs
                averageVisitDuration: 0, // TODO: Calculate average
                lastVisitDate: lastVisit?.actionTime || visitor.createdAt,
                createdBy: visitor.creator.name,
                organization: visitor.creator.organization?.fullName || 'N/A',
            };
        });

        return reportData;
    }

    async generateSecurityEventsReport(dateRange: any, user: UserContext) {
        // TODO: Implement security events report
        // This would include failed access attempts, unauthorized entries, etc.
        return [];
    }

    private calculateDateRange(timeRange: TimeRange, startDate?: string, endDate?: string) {
        const now = new Date();
        let start: Date;
        let end: Date;

        switch (timeRange) {
            case TimeRange.TODAY:
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;

            case TimeRange.YESTERDAY:
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                start = new Date(
                    yesterday.getFullYear(),
                    yesterday.getMonth(),
                    yesterday.getDate()
                );
                end = new Date(
                    yesterday.getFullYear(),
                    yesterday.getMonth(),
                    yesterday.getDate(),
                    23,
                    59,
                    59
                );
                break;

            case TimeRange.THIS_WEEK:
                const startOfWeek = new Date(now);
                startOfWeek.setDate(now.getDate() - now.getDay());
                start = new Date(
                    startOfWeek.getFullYear(),
                    startOfWeek.getMonth(),
                    startOfWeek.getDate()
                );
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
                break;

            case TimeRange.LAST_WEEK:
                const lastWeekStart = new Date(now);
                lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
                const lastWeekEnd = new Date(lastWeekStart);
                lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
                start = new Date(
                    lastWeekStart.getFullYear(),
                    lastWeekStart.getMonth(),
                    lastWeekStart.getDate()
                );
                end = new Date(
                    lastWeekEnd.getFullYear(),
                    lastWeekEnd.getMonth(),
                    lastWeekEnd.getDate(),
                    23,
                    59,
                    59
                );
                break;

            case TimeRange.THIS_MONTH:
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;

            case TimeRange.LAST_MONTH:
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
                break;

            case TimeRange.CUSTOM:
                if (!startDate || !endDate) {
                    throw new BadRequestException(
                        'Start date and end date are required for custom time range'
                    );
                }
                start = new Date(startDate);
                end = new Date(endDate);
                break;

            default:
                throw new BadRequestException('Invalid time range');
        }

        return {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
        };
    }

    private async applyRoleBasedFiltering(params: any, user: UserContext) {
        const { departmentIds, employeeIds } = params;

        // For HR role, filter by organization
        if (user.role === Role.HR) {
            // Validate department IDs belong to user's organization
            if (departmentIds && departmentIds.length > 0) {
                const validDepartments = await this.prisma.department.findMany({
                    where: {
                        id: { in: departmentIds },
                        organizationId: user.organizationId,
                    },
                    select: { id: true },
                });

                if (validDepartments.length !== departmentIds.length) {
                    throw new ForbiddenException('Access denied to some departments');
                }
            }
        }

        // For Department Lead role, filter by assigned departments
        if (user.role === Role.DEPARTMENT_LEAD) {
            const allowedDepartmentIds = user.departmentIds || [];

            if (departmentIds && departmentIds.length > 0) {
                const hasAccess = departmentIds.every(id => allowedDepartmentIds.includes(id));
                if (!hasAccess) {
                    throw new ForbiddenException('Access denied to some departments');
                }
            }
        }

        return { departmentIds, employeeIds };
    }

    private calculateWorkingDays(startDate: Date, endDate: Date): number {
        let count = 0;
        const current = new Date(startDate);

        while (current <= endDate) {
            const dayOfWeek = current.getDay();
            // Skip weekends (0 = Sunday, 6 = Saturday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                count++;
            }
            current.setDate(current.getDate() + 1);
        }

        return count;
    }

    private async exportReport(data: any, reportType: ReportType, format: ExportFormat) {
        // TODO: Implement actual export functionality
        // This would use libraries like puppeteer for PDF, exceljs for Excel, etc.

        return {
            message: `Report exported as ${format}`,
            reportType,
            format,
            downloadUrl: `/api/reports/download/${Date.now()}.${format.toLowerCase()}`,
            data,
        };
    }
}
