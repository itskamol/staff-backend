import { IsOptional, IsDateString, IsEnum, IsInt, Min, IsArray, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export enum ReportType {
    ATTENDANCE = 'ATTENDANCE',
    PRODUCTIVITY = 'PRODUCTIVITY',
    DEVICE_USAGE = 'DEVICE_USAGE',
    VISITOR_ACTIVITY = 'VISITOR_ACTIVITY',
    SECURITY_EVENTS = 'SECURITY_EVENTS',
}

export enum ExportFormat {
    PDF = 'PDF',
    EXCEL = 'EXCEL',
    CSV = 'CSV',
}

export enum TimeRange {
    TODAY = 'TODAY',
    YESTERDAY = 'YESTERDAY',
    THIS_WEEK = 'THIS_WEEK',
    LAST_WEEK = 'LAST_WEEK',
    THIS_MONTH = 'THIS_MONTH',
    LAST_MONTH = 'LAST_MONTH',
    CUSTOM = 'CUSTOM',
}

export class GenerateReportDto {
    @ApiProperty({
        description: 'Type of report to generate',
        enum: ReportType,
        example: ReportType.ATTENDANCE,
    })
    @IsEnum(ReportType)
    reportType: ReportType;

    @ApiProperty({
        description: 'Time range for the report',
        enum: TimeRange,
        example: TimeRange.THIS_MONTH,
    })
    @IsEnum(TimeRange)
    timeRange: TimeRange;

    @ApiPropertyOptional({
        description: 'Start date for custom time range (ISO string)',
        example: '2024-01-01T00:00:00Z',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for custom time range (ISO string)',
        example: '2024-01-31T23:59:59Z',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Department IDs to filter by',
        type: [Number],
        example: [1, 2, 3],
    })
    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    departmentIds?: number[];

    @ApiPropertyOptional({
        description: 'Employee IDs to filter by',
        type: [Number],
        example: [1, 2, 3],
    })
    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    employeeIds?: number[];

    @ApiPropertyOptional({
        description: 'Export format for the report',
        enum: ExportFormat,
        example: ExportFormat.PDF,
    })
    @IsOptional()
    @IsEnum(ExportFormat)
    exportFormat?: ExportFormat;
}

export class AttendanceReportDto {
    @ApiPropertyOptional({
        description: 'Start date for attendance report',
        example: '2024-01-01',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for attendance report',
        example: '2024-01-31',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Department ID to filter by',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    departmentId?: number;
}

export class ProductivityReportDto {
    @ApiPropertyOptional({
        description: 'Start date for productivity report',
        example: '2024-01-01',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for productivity report',
        example: '2024-01-31',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Employee IDs to include in report',
        type: [Number],
        example: [1, 2, 3],
    })
    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    employeeIds?: number[];
}

export class DeviceUsageReportDto {
    @ApiPropertyOptional({
        description: 'Start date for device usage report',
        example: '2024-01-01',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for device usage report',
        example: '2024-01-31',
    })
    @IsOptional()
    @IsDateString()
    endDate?: string;

    @ApiPropertyOptional({
        description: 'Gate IDs to filter by',
        type: [Number],
        example: [1, 2],
    })
    @IsOptional()
    @IsArray()
    @Type(() => Number)
    @IsInt({ each: true })
    gateIds?: number[];
}

export interface AttendanceReportData {
    employeeId: number;
    employeeName: string;
    department: string;
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    lateArrivals: number;
    earlyDepartures: number;
    totalWorkingHours: number;
    averageWorkingHours: number;
    attendancePercentage: number;
}

export interface ProductivityReportData {
    employeeId: number;
    employeeName: string;
    department: string;
    totalActiveTime: number;
    productiveTime: number;
    unproductiveTime: number;
    idleTime: number;
    productivityPercentage: number;
    topApplications: Array<{
        name: string;
        timeSpent: number;
        percentage: number;
    }>;
    topWebsites: Array<{
        url: string;
        timeSpent: number;
        percentage: number;
    }>;
}

export interface DeviceUsageReportData {
    deviceId: number;
    deviceName: string;
    gateName: string;
    totalEntries: number;
    totalExits: number;
    peakUsageHour: string;
    averageEntriesPerDay: number;
    mostActiveDay: string;
    usageByHour: Array<{
        hour: number;
        entries: number;
        exits: number;
    }>;
}

export interface VisitorActivityReportData {
    visitorId: number;
    visitorName: string;
    totalVisits: number;
    totalDuration: number;
    averageVisitDuration: number;
    lastVisitDate: Date;
    createdBy: string;
    organization: string;
}
