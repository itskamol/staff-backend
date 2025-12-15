import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ActionMode, ActionStatus, ActionType, EntryType, VisitorType } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateActionDto {
    @IsOptional()
    @IsInt()
    deviceId?: number;

    @IsOptional()
    @IsInt()
    gateId?: number;

    @IsDateString()
    actionTime: string;

    @IsOptional()
    @IsInt()
    employeeId?: number;

    @IsOptional()
    @IsInt()
    visitorId?: number;

    @IsEnum(VisitorType)
    visitorType: VisitorType;

    @IsEnum(EntryType)
    entryType: EntryType;

    @IsEnum(ActionType)
    actionType: ActionType;

    @IsOptional()
    @IsString()
    actionResult?: string;

    @IsEnum(ActionMode)
    actionMode: ActionMode;

    @IsOptional()
    @IsEnum(ActionStatus)
    status?: ActionStatus;

    @IsInt()
    organizationId: number;

    @IsInt()
    credentialId?: number;
}

export class UpdateActionDto extends PartialType(CreateActionDto) {}

export class ActionQueryDto extends QueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    deviceId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    gateId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    employeeId?: number;

    @ApiPropertyOptional({ enum: ActionStatus })
    @IsOptional()
    @IsEnum(ActionStatus)
    status?: ActionStatus;
}
