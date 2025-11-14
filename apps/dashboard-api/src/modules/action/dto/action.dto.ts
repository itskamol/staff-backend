import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { ActionMode, ActionStatus, ActionType, EntryType, VisitorType } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from "class-validator";

export class CreateActionDto {
    @IsOptional()
    @IsString()
    deviceId?: string;

    @IsOptional()
    @IsString()
    gateId?: string;

    @IsDateString()
    actionTime: string;

    @IsOptional()
    @IsString()
    employeeId?: string;

    @IsOptional()
    @IsString()
    visitorId?: string;

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

    @IsString()
    organizationId: string
}

export class UpdateActionDto extends PartialType(CreateActionDto) { }


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
    @IsString()
    deviceId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    gateId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiPropertyOptional({enum: ActionStatus})
    @IsOptional()
    @IsEnum(ActionStatus)
    status?: ActionStatus
}