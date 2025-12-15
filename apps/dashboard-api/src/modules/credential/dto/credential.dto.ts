import {
    IsString,
    IsInt,
    IsBoolean,
    IsOptional,
    IsEnum,
    MinLength,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ActionType } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class CreateCredentialDto {
    @ApiProperty({ description: 'The ID of the employee this credential belongs to' })
    @Type(() => Number)
    @IsInt()
    employeeId: number;

    @ApiProperty({
        description:
            'The unique code associated with the credential (e.g., card number, license plate)',
        minLength: 1,
        maxLength: 50,
        required: false,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    @IsOptional()
    code: string;

    @ApiProperty({ enum: ActionType, description: 'The type of credential being created' })
    @IsEnum(ActionType)
    type: ActionType;

    @ApiPropertyOptional({
        description: 'Additional descriptive details about the credential',
        nullable: true,
    })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    additionalDetails?: string;

    @ApiPropertyOptional({
        description: 'Whether the credential is currently active',
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsInt()
    organizationId?: number;
}

export class UpdateCredentialDto extends PartialType(CreateCredentialDto) {}

export class CredentialResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    code: string;

    @ApiProperty({ enum: ActionType })
    type: ActionType;

    @ApiProperty()
    employeeId: number;

    @ApiProperty()
    isActive: boolean;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;
}

export class CredentialQueryDto extends QueryDto {
    @ApiPropertyOptional({ enum: ActionType, description: 'Filter by Action Type' })
    @IsEnum(ActionType)
    @IsOptional()
    type?: ActionType;

    @ApiPropertyOptional({ description: 'Filter by Employee ID' })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    employeeId?: number;

    @ApiPropertyOptional({ description: 'Filter by Department ID' })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    departmentId?: number;

    @ApiPropertyOptional({ description: 'Filter by Organization ID' })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    organizationId?: number;
}
