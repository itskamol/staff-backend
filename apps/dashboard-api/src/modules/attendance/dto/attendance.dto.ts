// ...existing code...
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsDateString,
    isEnum,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActionStatus } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class CreateAttendanceDto {
    @ApiProperty({ example: '2025-11-10T09:00:00.000Z' })
    @IsNotEmpty()
    @IsDateString()
    startTime: string;

    @ApiPropertyOptional({ example: '2025-11-10T18:00:00.000Z' })
    @IsOptional()
    @IsDateString()
    endTime?: string;

    @ApiProperty({ example: 'ON_TIME' })
    @IsNotEmpty()
    @IsEnum(ActionStatus)
    arrivalStatus: ActionStatus;

    @ApiPropertyOptional({ example: 'ON_TIME' })
    @IsOptional()
    @IsEnum(ActionStatus)
    goneStatus?: ActionStatus;

    @ApiPropertyOptional({ example: 'Reason for late arrival' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiProperty({ example: 1 })
    @IsNotEmpty()
    @IsInt()
    @Type(() => Number)
    employeeId: number;

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    organizationId?: number;

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    reasonTypeId?: number;
}

export class UpdateAttendanceDto {
    @ApiPropertyOptional({ example: 'Updated reason' })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    reasonTypeId?: number;

    @IsOptional()
    @IsDateString()
    endTime?: Date;

    @IsOptional()
    @IsDateString()
    startTime?: Date;

    @IsOptional()
    @IsEnum(ActionStatus)
    goneStatus?: ActionStatus;
}

export class AttendanceQueryDto extends QueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    employeeId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    organizationId?: number;

    @ApiPropertyOptional({
        description: 'Specific date (e.g. 2025-11-11)',
    })
    @IsOptional()
    @IsDateString()
    date?: string;

    @ApiPropertyOptional({ enum: ActionStatus })
    @IsOptional()
    @IsEnum(ActionStatus)
    arrivalStatus?: ActionStatus;

    @ApiPropertyOptional({ enum: ActionStatus })
    @IsOptional()
    @IsEnum(ActionStatus)
    goneStatus?: ActionStatus;
}
