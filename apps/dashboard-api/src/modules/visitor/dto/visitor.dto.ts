import {
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
    IsNotEmpty,
    MaxLength,
    IsPhoneNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { VisitorCodeType } from '@prisma/client';

export class CreateVisitorDto {
    @ApiProperty({ description: 'First name of the visitor' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    firstName: string;

    @ApiProperty({ description: 'Last name of the visitor' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    lastName: string;

    @ApiPropertyOptional({ description: 'Middle name of the visitor' })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    middleName?: string;

    @ApiPropertyOptional({ description: 'Birthday of the visitor (YYYY-MM-DD format)' })
    @IsOptional()
    @IsString()
    birthday?: string;

    @ApiPropertyOptional({ description: 'Phone number of the visitor' })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @ApiPropertyOptional({ description: 'Passport number of the visitor' })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    passportNumber?: string;

    @ApiPropertyOptional({ description: 'PINFL (Personal Identification Number) of the visitor' })
    @IsOptional()
    @IsString()
    @MaxLength(14)
    pinfl?: string;

    @ApiPropertyOptional({ description: 'Work place of the visitor' })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    workPlace?: string;

    @ApiPropertyOptional({ description: 'Additional details about the visitor' })
    @IsOptional()
    @IsString()
    additionalDetails?: string;
}

export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {}

export class GenerateCodeDto {
    @ApiProperty({
        description: 'Type of the visitor code',
        enum: VisitorCodeType,
        example: VisitorCodeType.ONETIME,
    })
    @IsEnum(VisitorCodeType)
    codeType: VisitorCodeType;

    @ApiProperty({
        description: 'Start date and time for the code validity',
        example: '2024-01-01T09:00:00Z',
    })
    @IsDateString()
    startDate: string;

    @ApiProperty({
        description: 'End date and time for the code validity',
        example: '2024-01-01T18:00:00Z',
    })
    @IsDateString()
    endDate: string;

    @ApiPropertyOptional({ description: 'Additional details for the code' })
    @IsOptional()
    @IsString()
    additionalDetails?: string;
}
