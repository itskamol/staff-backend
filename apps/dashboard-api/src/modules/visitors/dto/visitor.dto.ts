import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsInt,
    IsDateString,
    IsEnum,
    IsArray,
    ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { VisitorCodeType } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto/query.dto';
import { OnetimeCodeDto } from '../../onetime-codes/dto/onetime-code.dto';

export class CreateVisitorDto {
    @ApiProperty({
        example: 'John',
        description: 'Visitor first name',
    })
    @IsString()
    @IsNotEmpty()
    firstName: string;

    @ApiProperty({
        example: 'Smith',
        description: 'Visitor last name',
    })
    @IsString()
    @IsNotEmpty()
    lastName: string;

    @ApiProperty({
        example: 'William',
        description: 'Visitor middle name',
        required: false,
    })
    @IsOptional()
    @IsString()
    middleName?: string;

    @ApiProperty({
        example: '1990-05-15',
        description: 'Visitor birthday',
        required: false,
    })
    @IsOptional()
    @IsString()
    birthday?: string;

    @ApiProperty({
        example: '+998901234567',
        description: 'Visitor phone number',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        example: 'AB1234567',
        description: 'Passport number',
        required: false,
    })
    @IsOptional()
    @IsString()
    passportNumber?: string;

    @ApiProperty({
        example: '12345678901234',
        description: 'PINFL (Personal Identification Number)',
        required: false,
    })
    @IsOptional()
    @IsString()
    pinfl?: string;

    @ApiProperty({
        example: 'ABC Company LLC',
        description: 'Visitor workplace',
        required: false,
    })
    @IsOptional()
    @IsString()
    workPlace?: string;

    @ApiProperty({
        example: 'VIP guest, requires special attention',
        description: 'Additional details',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({
        example: 1,
        description: 'Creator user ID',
    })
    @IsInt()
    @IsNotEmpty()
    organizationId: number;

    @ApiProperty({
        example: 2,
        description: 'Attached user ID',
        required: false,
    })
    @IsOptional()
    @IsInt()
    attachedId?: number;

    @ApiProperty({
        example: true,
        description: 'Visitor active status',
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {}

export class VisitorDto extends CreateVisitorDto {
    @ApiProperty({ example: 1, description: 'Visitor ID' })
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

export class QueryVisitorDto extends QueryDto {
    @ApiProperty({
        example: 1,
        description: 'Filter by Creator User ID',
        required: false,
    })
    @IsOptional()
    @IsInt()
    creatorId?: number;

    @ApiProperty({
        example: 1,
        description: 'Filter by attached ID',
        required: false,
    })
    @IsOptional()
    @IsInt()
    attachedId?: number;
}

export class AssignVisitorToGatesDto {
    @ApiProperty({
        example: 1,
        description: 'Gate ID (Bitta darvoza IDsi)',
        type: Number,
    })
    @IsInt()
    gateId: number; // Nomini gateIds dan gateId ga o'zgartirdik (chunki u bitta son)

    @ApiProperty({
        example: [5, 6, 7],
        description: 'Visitor IDlari ro‘yxati',
        type: [Number],
    })
    @IsArray()
    @IsInt({ each: true })
    visitorIds: number[];
}
