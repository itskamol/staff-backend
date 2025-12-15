import { IsOptional, IsDateString, IsEnum, IsInt, Min, IsArray, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EmployeeResponseDto } from '../../employee/dto';
import { EmployeePlanRepository } from '../../employeePlan/employee-plan.repository';
import { CreateEmployeePlanDto } from '../../employeePlan/employee-plan.dto';

export class AttendanceReportDto {
    @ApiPropertyOptional({
        description: 'Start date for attendance report',
        example: '2025-11-30',
    })
    @IsOptional()
    @IsDateString()
    startDate?: string;

    @ApiPropertyOptional({
        description: 'End date for attendance report',
        example: '2025-12-15',
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

    @ApiPropertyOptional({
        description: 'Organization ID to filter by',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    organizationId?: number;
}

export interface AttendanceMainReportData {
    fio?: string;
    position?: string;
    department?: string;
    workSchedule?: string;
    daysStatistics?: {
        weekDay?: string;
        status?: 'ON_TIME' | 'ABSENT' | 'LATE' | 'WEEKEND';
        startTime?: string;
        endTime?: string;
        totalHours?: string;
    }[]; // har bir kunlik statistikalar
    totalHoursPlan?: string;
    totalHoursLate?: string;
    totalHoursEarly?: string;
    totalWorkedHours?: string;
    ontimeHours?: string;
    overtimeHours?: string;
    overtimePlanHours?: string; // plandan tashqari dam olish kunlari ishlagan soatlar
    resonableAbsentHours?: string;
    unresaonableAbsentHours?: string;
    total?: string; // ontimeHours + overtimeHours + overtimePlanHours
    totalDays?: number;
}

export interface AttendanceDateData {
    date?: string; // DD/MM
    weekday?: string; // Mon, Tue, Wed
}

export interface AttendanceReportData {
    dateData?: AttendanceDateData[];
    reportData?: AttendanceMainReportData[];
}
