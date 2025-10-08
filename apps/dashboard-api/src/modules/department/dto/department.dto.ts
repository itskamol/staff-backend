import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateIf, MaxLength, IsEmail, IsPhoneNumber } from 'class-validator';

export class CreateDepartmentDto {
    @ApiProperty({
        description: 'Full name of the department',
        example: 'Human Resources Department',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    fullName: string;

    @ApiProperty({
        description: 'Short name of the department',
        example: 'HR',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    shortName: string;

    @ApiProperty({
        description: 'Email address',
        example: 'hr@company.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+998901234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        description: 'Address',
        example: '123 Main St, Tashkent',
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

    @ApiProperty({
        description: 'The ID of the organization (Required for ADMIN, auto-populated for HR from token)',
        example: 1,
        required: false,
    })
    @ValidateIf((o, context) => {
        const request = context?.['request'];
        return request?.user?.role === 'ADMIN';
    })
    @IsNumber()
    @IsNotEmpty({ message: 'Organization ID is required for ADMIN users' })
    @IsOptional()
    organizationId?: number;

    @ApiProperty({
        description: 'The ID of the parent department, if this is a sub-department.',
        example: 2,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    parentId?: number;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class DepartmentResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the department.',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'Full name of the department',
        example: 'Human Resources Department',
    })
    fullName: string;

    @ApiProperty({
        description: 'Short name of the department',
        example: 'HR',
    })
    shortName: string;

    @ApiProperty({
        description: 'Email address',
        example: 'hr@company.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'Phone number',
        example: '+998901234567',
        required: false,
    })
    phone?: string;

    @ApiProperty({
        description: 'Address',
        example: '123 Main St, Tashkent',
        required: false,
    })
    address?: string;

    @ApiProperty({
        description: 'Additional details',
        required: false,
    })
    additionalDetails?: string;

    @ApiProperty({
        description: 'Organization ID',
        example: 1,
    })
    organizationId: number;

    @ApiProperty({
        description: 'Parent department ID',
        example: 2,
        required: false,
    })
    parentId?: number;

    @ApiProperty({
        description: 'The date and time when the department was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the department was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'A list of child departments.',
        type: () => [DepartmentResponseDto],
        required: false,
    })
    children?: DepartmentResponseDto[];

    @ApiProperty({
        description: 'The parent department.',
        type: () => DepartmentResponseDto,
        required: false,
    })
    parent?: DepartmentResponseDto;

    @ApiProperty({
        description: 'Organization information',
        required: false,
    })
    organization?: {
        id: number;
        fullName: string;
        shortName: string;
    };
}
