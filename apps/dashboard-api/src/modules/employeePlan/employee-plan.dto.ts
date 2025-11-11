import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsInt, IsArray } from 'class-validator';

export class CreateEmployeePlanDto {

    @ApiProperty({ example: 'Schedule Name' })
    @IsNotEmpty()
    @IsString()
    name: string;

    @ApiProperty({ example: 'Schedule addadditionalDetails' })
    @IsOptional()
    @IsString()
    addadditionalDetails?: string;

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

    @ApiProperty({ example: ['Mon', 'Fri'] })
    @IsNotEmpty()
    @IsString({ each: true })
    @Transform(({ value }) => Array.isArray(value) ? value.join(',') : value)
    weekdays: string; // ← bazaga string sifatida ketadi

    @ApiProperty({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsInt()
    organizationId?: number

}

export class UpdateEmployeePlanDto extends PartialType(CreateEmployeePlanDto) { }

export class AssignEmployeesDto {
    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsInt()
    employeePlanId: number;

    @ApiProperty({ example: [1, 2, 3] })
    @IsArray()
    @IsInt({ each: true })
    employeeIds: number[];
}

export class EmployeePlanQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

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
