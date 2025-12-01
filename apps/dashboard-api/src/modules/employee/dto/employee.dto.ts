import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { ActionType } from '@prisma/client';
import {
    IsBoolean,
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    ValidateIf,
    IsInt,
    IsEnum,
    IsArray,
} from 'class-validator';
import { CreateCredentialDto } from '../../credential/dto/credential.dto';
import { Type } from 'class-transformer';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

class EmployeeCredentialDto extends OmitType(CreateCredentialDto, [
    'employeeId',
    'organizationId',
]) {}

export class CreateEmployeeDto {
    @ApiProperty({
        description:
            'The ID of the organization (Required for ADMIN, auto-populated for HR from token)',
        example: 1,
        required: false,
    })
    @ValidateIf((o, context) => {
        const request = context?.['request'];
        return request?.user?.role === 'ADMIN';
    })
    @IsInt()
    @IsNotEmpty({ message: 'Organization ID is required for ADMIN users' })
    @IsOptional()
    organizationId?: number;

    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 1,
    })
    @IsInt()
    @IsNotEmpty()
    departmentId: number;

    @ApiProperty({
        description: 'The ID of the employee group.',
        example: 1,
    })
    @IsInt()
    @IsOptional()
    groupId?: number;

    @ApiProperty({
        description: 'The ID of the policy.',
        example: 1,
    })
    @IsInt()
    @IsOptional()
    policyId?: number;

    @ApiProperty({
        description: "The employee's full name.",
        example: 'John Doe',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: "The employee's address.",
        example: '123 Main St, City, Country',
        required: false,
    })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '+998901234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@company.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'The storage path for employee photo.',
        example: 'employees/photos/john-doe.jpg',
        required: false,
    })
    @IsOptional()
    @IsString()
    photo?: string;

    @ApiProperty({
        description: 'Additional details about the employee.',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({
        description: 'Indicates if the employee is currently active.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        description: 'Employee credentials',
        required: false,
        type: [EmployeeCredentialDto],
    })
    @IsOptional()
    @IsArray()
    credentials: EmployeeCredentialDto[];
}

export class UpdateEmployeeDto {
    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsInt()
    departmentId?: number;

    @ApiProperty({
        description: 'The ID of the employee group.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsInt()
    policyId?: number;

    @ApiProperty({
        description: "The employee's full name.",
        example: 'John Doe',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: "The employee's address.",
        example: '123 Main St, City, Country',
        required: false,
    })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '+998901234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@company.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'The storage path for employee photo.',
        example: 'employees/photos/john-doe.jpg',
        required: false,
    })
    @IsOptional()
    @IsString()
    photo?: string;

    @ApiProperty({
        description: 'Additional details about the employee.',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({
        description: 'Indicates if the employee is currently active.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsInt()
    @IsOptional()
    employeePlanId?: number;
}

export class BulkUpdateEmployees {
    @ApiProperty({
        description: 'Array of employee IDs to be updated.',
        example: [1, 2, 3],
        type: [Number],
    })
    @IsNotEmpty()
    @IsInt({ each: true })
    employeeIds: number[];

    @ApiProperty({
        description: 'Data to update for the specified employees.',
    })
    @IsNotEmpty()
    policyId?: number;
}

export class EmployeeResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the employee.',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'Organization ID',
        example: 1,
    })
    organizationId: number;

    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 1,
    })
    departmentId: number;

    @ApiProperty({
        description: 'The ID of the employee group.',
        example: 1,
    })
    policyId: number;

    @ApiProperty({
        description: "The employee's full name.",
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: "The employee's address.",
        example: '123 Main St, City, Country',
        required: false,
    })
    address?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '+998901234567',
        required: false,
    })
    phone?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@company.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'The storage path for employee photo.',
        example: 'employees/photos/john-doe.jpg',
        required: false,
    })
    photo?: string;

    @ApiProperty({
        description: 'Additional details about the employee.',
        required: false,
    })
    additionalDetails?: string;

    @ApiProperty({
        description: 'Indicates if the employee is currently active.',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'The date and time when the employee was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the employee was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Department information',
        required: false,
    })
    department?: {
        id: number;
        fullName: string;
        shortName: string;
        organizationId: number;
    };

    @ApiProperty({
        description: 'Employee group information',
        required: false,
    })
    group?: {
        id: number;
        name: string;
        organizationId: number;
    };

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

export class EmployeeQueryDto extends QueryDto {
    @ApiProperty({
        enum: ActionType,
        required: false,
    })
    @IsOptional()
    @IsEnum(ActionType)
    credentialType: ActionType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    departmentId?: number;
}
