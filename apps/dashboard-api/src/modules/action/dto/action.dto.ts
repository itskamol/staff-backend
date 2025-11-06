import { ApiPropertyOptional } from "@nestjs/swagger";
import { ActionMode, ActionStatus, ActionType, EntryType, VisitorType } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";

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

    @IsEnum(ActionStatus)
    status: ActionStatus

    @IsInt()
    organizationId: number
}

export class UpdateActionDto extends CreateActionDto { }


export class ActionQueryDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    page?: number;


    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    limit?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    deviceId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    gateId?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    employeeId?: number;

    @ApiPropertyOptional({enum: ActionStatus})
    @IsOptional()
    @IsEnum(ActionStatus)
    status?: ActionStatus
}