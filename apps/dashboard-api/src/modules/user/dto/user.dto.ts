import { ApiProperty } from '@nestjs/swagger';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    MinLength,
    ValidateIf,
} from 'class-validator';
import { Role } from '../../../shared/enums';
import { Type } from 'class-transformer';

export class CreateUserDto {
    @ApiProperty({
        description: 'The username of the user.',
        example: 'username123',
    })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({
        description:
            'The password for the user account. It must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
        example: 'Password123!',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    password: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'The role of the user.',
        enum: Role,
        example: Role.HR,
    })
    @IsEnum(Role)
    @IsNotEmpty()
    role: Role;

    @ApiProperty({
        description:
            'The ID of the organization (Required when creating HR users, optional for SUPER_ADMIN)',
        example: 1,
        required: false,
    })
    @ValidateIf(o => o.role === Role.HR || o.role === Role.ADMIN)
    @IsNumber()
    @IsNotEmpty({ message: 'Organization ID is required for HR and ADMIN users' })
    @IsOptional()
    organizationId?: number;

    @ApiProperty({ type: [Number], required: false })
    @IsArray()
    @IsOptional()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    departmentIds?: number[];

    @ApiProperty({
        description: 'The status of the user account. Defaults to true.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateCurrentUserDto {
    @ApiProperty({
        description: 'The username of the user.',
        example: 'username123',
        required: false,
    })
    @IsString()
    @IsOptional()
    username?: string;

    @ApiProperty({
        description: 'The name of the user.',
        example: 'John Doe',
        required: false,
    })
    @IsString()
    @IsOptional()
    name?: string;

    @ApiProperty({
        description: 'The current password of the user.',
        example: 'Password123!',
    })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiProperty({
        description:
            'The new password for the user account. It must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
        example: 'NewPassword456!',
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    newPassword: string;
}

export class UpdateUserDto {
    @ApiProperty({
        description: 'The username of the user.',
        example: 'john.doe',
        required: false,
    })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({
        description: 'The role of the user.',
        enum: Role,
        example: Role.HR,
        required: false,
    })
    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @ApiProperty({
        description: 'The ID of the organization the user belongs to.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    organizationId?: number;

    @ApiProperty({
        description: 'The password for the user account.',
        example: 'NewPassword123!',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    password?: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
        required: false,
    })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        description: 'The status of the user account.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ type: [Number], required: false })
    @IsArray()
    @IsOptional()
    @IsNumber({}, { each: true })
    @Type(() => Number)
    departmentIds?: number[];
}

export class AssignUserToDepartmentDto {
    @ApiProperty({
        description: 'The IDs of the departments to assign the user to.',
        example: [1, 2, 3],
        type: [Number],
    })
    @IsNotEmpty({ each: true })
    @IsNumber({}, { each: true })
    departmentIds: number[];
}

export class UserResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the user.',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'The username of the user.',
        example: 'username123',
    })
    username: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: 'The role of the user.',
        enum: Role,
        example: Role.HR,
    })
    role: Role;

    @ApiProperty({
        description: 'Organization ID',
        example: 1,
        required: false,
    })
    organizationId?: number;

    @ApiProperty({
        description: 'The status of the user account.',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'The date and time when the user was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the user was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'Organization information',
        required: false,
    })
    organization?: {
        id: number;
        fullName: string;
        shortName: string;
    };

    @ApiProperty({
        description: 'Departments the user has access to',
        required: false,
    })
    departments?: Array<{
        id: number;
        fullName: string;
        shortName: string;
    }>;
}
