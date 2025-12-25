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

export class AttendanceReportByEmployeeDto {
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
        description: 'EmployeeId ID to filter by',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    employeeId?: number;
}

export interface AttendanceMainReportData {
    fio?: string; // ism-sharif
    position?: string; // pozitsiyasi / kasbi
    department?: string; // departament nomi
    workSchedule?: string; // ish jadvali hafta kuni va soati
    daysStatistics?: {
        status?: 'ON_TIME' | 'ABSENT' | 'LATE' | 'WEEKEND' | 'EARLY' | 'PENDING';
        startTime?: string;
        endTime?: string;
        totalMinutes?: number; // ishlagan minutlar
    }[];
    totalPlannedMinutes?: number; // reja bo'yicha minutlar
    totalLateMinutes?: number; // jami kech kelgan minutlar
    totalEarlyMinutes?: number; // jami erta ketgan minutlar
    totalWorkedMinutes?: number; // ummumiy ishlagan minutlar
    onTimeMinutes?: number; // o'z vaqtida ishlagan minutlar
    overtimeMinutes?: number; // ish grafigidan tashqari minutlar
    overtimePlanMinutes?: number; // dam olish kunlari ishlagan minutlar
    reasonableAbsentMinutes?: number; // sababli absent minutlari
    unreasonableAbsentMinutes?: number; // sababsiz absent minutlari
    totalMinutes?: number; // onTime + overtime + overtimePlan
    totalDays?: number; // jami ishlagan kunlar
}

export interface AttendanceDateData {
    date?: string; // DD/MM
    weekday?: string; // Mon, Tue, Wed
}

export interface AttendanceReportData {
    dateData?: AttendanceDateData[];
    reportData?: AttendanceMainReportData[];
}

export interface AttendanceStats {
    averageArrivalTime: number;

    avgArrivalEarlyMinutes: number;
    avgArrivalLateMinutes: number;

    averageLeaveTime: number;

    avgLeaveEarlyMinutes: number;
    avgLeaveOvertimeMinutes: number;

    totalTrackedHours: number;
    lateArrivalsCount: number;
    earlyLeavesCount: number;
}
