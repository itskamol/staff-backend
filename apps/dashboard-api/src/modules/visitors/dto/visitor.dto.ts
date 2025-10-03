import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { VisitorCodeType } from '@prisma/client';

export class CreateVisitorDto {
    @ApiProperty({
        example: 'John',
        description: 'Visitor first name'
    })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({
        example: 'Smith',
        description: 'Visitor last name'
    })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({
        example: 'William',
        description: 'Visitor middle name',
        required: false
    })
    @IsOptional()
    @IsString()
    middleName?: string;

    @ApiProperty({
        example: '1990-05-15',
        description: 'Visitor birthday',
        required: false
    })
    @IsOptional()
    @IsString()
    birthday?: string;

    @ApiProperty({
        example: '+998901234567',
        description: 'Visitor phone number',
        required: false
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        example: 'AB1234567',
        description: 'Passport number',
        required: false
    })
    @IsOptional()
    @IsString()
    passportNumber?: string;

    @ApiProperty({
        example: '12345678901234',
        description: 'PINFL (Personal Identification Number)',
        required: false
    })
    @IsOptional()
    @IsString()
    pinfl?: string;

    @ApiProperty({
        example: 'ABC Company LLC',
        description: 'Visitor workplace',
        required: false
    })
    @IsOptional()
    @IsString()
    workPlace?: string;

    @ApiProperty({
        example: 'VIP guest, requires special attention',
        description: 'Additional details',
        required: false
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({
        example: 1,
        description: 'Creator user ID'
    })
    @IsInt()
    @IsNotEmpty()
    creatorId: number;

    @ApiProperty({
        example: true,
        description: 'Visitor active status',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateVisitorDto extends PartialType(CreateVisitorDto) { }

export class VisitorDto extends CreateVisitorDto {
    @ApiProperty({ example: 1, description: 'Visitor ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;
}

export class CreateOnetimeCodeDto {
    @ApiProperty({
        example: 1,
        description: 'Visitor ID'
    })
    @IsInt()
    @IsNotEmpty()
    visitorId: number;

    @ApiProperty({
        example: 'ONETIME',
        description: 'Code type',
        enum: VisitorCodeType
    })
    @IsEnum(VisitorCodeType)
    codeType: VisitorCodeType;

    @ApiProperty({
        example: 'VIS123456',
        description: 'Generated code'
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({
        example: '2024-08-25T09:00:00Z',
        description: 'Code start date'
    })
    @IsDateString()
    startDate: string;

    @ApiProperty({
        example: '2024-08-25T18:00:00Z',
        description: 'Code end date'
    })
    @IsDateString()
    endDate: string;

    @ApiProperty({
        example: 'Single day access',
        description: 'Additional details',
        required: false
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({
        example: true,
        description: 'Code active status',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateOnetimeCodeDto extends PartialType(CreateOnetimeCodeDto) { }

export class OnetimeCodeDto extends CreateOnetimeCodeDto {
    @ApiProperty({ example: 1, description: 'Code ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;
}

export class VisitorWithRelationsDto extends VisitorDto {
    @ApiProperty({ description: 'Creator user information' })
    creator?: {
        id: number;
        name: string;
        username: string;
    };

    @ApiProperty({ description: 'Onetime codes' })
    onetimeCodes?: OnetimeCodeDto[];

    @ApiProperty({ description: 'Actions count' })
    actionsCount?: number;
}

export class GenerateCodeDto {
    @ApiProperty({
        example: 'ONETIME',
        description: 'Code type',
        enum: VisitorCodeType
    })
    @IsEnum(VisitorCodeType)
    codeType: VisitorCodeType;

    @ApiProperty({
        example: 24,
        description: 'Code validity in hours',
        required: false,
        default: 24
    })
    @IsOptional()
    @IsInt()
    validityHours?: number = 24;

    @ApiProperty({
        example: 'Meeting access code',
        description: 'Additional details',
        required: false
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;
}
