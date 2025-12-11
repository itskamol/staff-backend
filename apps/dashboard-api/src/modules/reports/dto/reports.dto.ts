import { IsOptional, IsDateString, IsEnum, IsInt, Min, IsArray, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

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
