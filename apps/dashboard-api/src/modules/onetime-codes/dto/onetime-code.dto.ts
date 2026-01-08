import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsInt,
    IsDateString,
    IsEnum,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { VisitorCodeType } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class CreateOnetimeCodeDto {
    @ApiProperty({
        example: 1,
        description: 'Visitor ID',
    })
    @IsInt()
    @IsNotEmpty()
    visitorId: number;

    @ApiProperty({
        example: 'ONETIME',
        description: 'Code type',
        enum: VisitorCodeType,
    })
    @IsEnum(VisitorCodeType)
    codeType: VisitorCodeType;

    @ApiProperty({
        example: '2026-01-08T16:31:46+05:00',
        description: 'Code start date',
    })
    @IsDateString()
    startDate: string;

    @ApiProperty({
        example: '2026-01-18T16:31:46+05:00',
        description: 'Code end date',
    })
    @IsDateString()
    endDate: string;

    @ApiProperty({
        example: 'Single day access',
        description: 'Additional details',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({
        example: true,
        description: 'Code active status',
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateOnetimeCodeDto extends PartialType(CreateOnetimeCodeDto) {}

export class QueryOnetimeCodeDto extends QueryDto {
    @ApiProperty({
        example: 1,
        description: 'Filter by Visitor ID',
        required: false,
    })
    @IsOptional()
    @IsInt()
    visitorId?: number;

    @ApiProperty({
        example: 'ONETIME',
        description: 'Filter by Code Type',
        enum: VisitorCodeType,
        required: false,
    })
    @IsOptional()
    @IsEnum(VisitorCodeType)
    codeType?: VisitorCodeType;
}

export class OnetimeCodeDto extends CreateOnetimeCodeDto {
    @ApiProperty({ example: 1, description: 'Code ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;
}

export class OnetimeCodeWithRelationsDto extends OnetimeCodeDto {
    @ApiProperty({ description: 'Visitor information' })
    visitor?: {
        id: number;
        firstName: string;
        lastName: string;
        workPlace: string;
    };
}

export class ActivateCodeDto {
    @ApiProperty({
        example: true,
        description: 'Activate or deactivate code',
    })
    @IsBoolean()
    isActive: boolean;
}
