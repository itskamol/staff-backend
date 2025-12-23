import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import {
    IsArray,
    IsEmail,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPhoneNumber,
    IsString,
    MaxLength,
} from 'class-validator';

export class CreateOrganizationDto {
    @ApiProperty({
        description: 'Full name of the organization',
        example: 'Acme Corporation',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    fullName: string;

    @ApiProperty({
        description: 'Short name of the organization',
        example: 'Acme',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    shortName: string;

    @ApiProperty({
        description: 'Email address',
        example: 'info@acme.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+998712345678',
        required: false,
    })
    @IsOptional()
    @IsPhoneNumber('UZ')
    phone?: string;

    @ApiProperty({
        description: 'Address',
        example: '123 Business St, Tashkent',
        required: false,
    })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({
        description: 'Additional details',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({ example: [1, 2, 3], description: 'Gates Ids' })
    @IsArray()
    @IsOptional()
    @IsInt({ each: true })
    gates: number[];
}

export class UpdateOrganizationDto extends PartialType(
    OmitType(CreateOrganizationDto, ['gates'] as const)
) {}

export class OrganizationResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the organization.',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'Full name of the organization',
        example: 'Acme Corporation',
    })
    fullName: string;

    @ApiProperty({
        description: 'Short name of the organization',
        example: 'Acme',
    })
    shortName: string;

    @ApiProperty({
        description: 'Email address',
        example: 'info@acme.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+998712345678',
        required: false,
    })
    phone?: string;

    @ApiProperty({
        description: 'Address',
        example: '123 Business St, Tashkent',
        required: false,
    })
    address?: string;

    @ApiProperty({
        description: 'Additional details',
        required: false,
    })
    additionalDetails?: string;

    @ApiProperty({
        description: 'The date and time when the organization was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the organization was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Departments count',
        required: false,
    })
    departmentCount?: number;

    @ApiProperty({
        description: 'Employees count',
        required: false,
    })
    employeeCount?: number;
}
