import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export interface DashboardStats {
    totalEmployees: number;
    newEmployeesCount: number;

    totalDepartments: number;
    newDepartmentsCount: number;

    totalComputers: number;
    newComputersCount: number;

    totalOrganizations: number;
    newOrganizationsCount: number;
}

export interface AttendanceChartDataDto {
    date: string;
    onTime: number;
    late: number;
    absent: number;
}

export interface AttendanceChartStatsDto {
    employeeCount: number;
    data: AttendanceChartDataDto[];
}

export class ChartStatsQueryDto {
    @ApiProperty({ example: '2025-12-10', required: false })
    @IsString()
    startDate: string;

    @ApiProperty({ example: '2025-12-10', required: false })
    @IsString()
    endDate: string;
}
