import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsInt, IsArray } from 'class-validator';

export class CreateEmployeePlanDto {
    @ApiProperty({ example: '09:00' })
    @IsNotEmpty()
    @IsString()
    startTime: string;

    @ApiProperty({ example: '18:00' })
    @IsNotEmpty()
    @IsString()
    endTime: string;

    @ApiProperty({ example: '00:10' })
    @IsNotEmpty()
    @IsString()
    extraTime: string;

    @ApiProperty({ example: 'Mon,Fri' })
    @IsNotEmpty()
    @IsString()
    weekdays: string;

    @ApiProperty({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateEmployeePlanDto extends CreateEmployeePlanDto { }

export class AssignEmployeesDto {
    @ApiProperty({example: 1})
    @IsNotEmpty()
    @IsInt()
    employeePlanId: number;

    @ApiProperty({example: [1,2,3]})
    @IsArray()
    @IsInt({ each: true })
    employeeIds: number[];
}

export class EmployeePlanQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    page?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    limit?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sortBy?: string; // e.g., 'startTime', 'endTime'

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}
