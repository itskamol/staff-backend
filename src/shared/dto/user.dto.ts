import { ApiProperty } from '@nestjs/swagger';
import {
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Matches,
    MinLength,
} from 'class-validator';
import { Role } from '../enums';

export class CreateUserDto {
    @ApiProperty({
        description: 'The email address of the user.',
        example: 'username123',
    })
    @IsString()
    username: string;

    @ApiProperty({
        description:
            'The password for the user account. It must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
        example: 'Password123!',
    })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    password: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
        required: false,
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: 'The role of the user.',
        enum: Role,
        example: Role.ADMIN,
    })
    @IsEnum(Role)
    role: Role;

    @ApiProperty({
        description: 'The status of the user account. Defaults to true.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateUserDto {
    @ApiProperty({
        description: 'The email address of the user.',
        example: 'john.doe@example.com',
        required: false,
    })
    @IsOptional()
    @IsString()
    username?: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    name?: string;

    @ApiProperty({
        description: 'The status of the user account.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class ChangePasswordDto {
    @ApiProperty({
        description: 'The current password of the user.',
        example: 'Password123!',
    })
    @IsString()
    currentPassword: string;

    @ApiProperty({
        description:
            'The new password for the user account. It must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
        example: 'NewPassword456!',
    })
    @IsString()
    @MinLength(8)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    newPassword: string;
}

export class AssignUserToOrganizationDto {
    @ApiProperty({
        description: 'The ID of the user to be assigned to the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    userId: string;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    organizationId: string;

    @ApiProperty({
        description: 'The role of the user within the organization.',
        enum: Role,
        example: Role.ADMIN,
    })
    @IsEnum(Role)
    role: Role;

    @ApiProperty({
        description: 'An array of branch IDs that the user will manage. This is optional.',
        example: ['a1b2c3d4-e5f6-7890-1234-567890abcdef'],
        required: false,
        type: [String],
    })
    @IsOptional()
    @IsString({ each: true })
    branchIds?: string[];
}

export class UserResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the user.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The email address of the user.',
        example: 'john.doe@example.com',
    })
    email: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
        required: false,
    })
    fullName?: string;

    @ApiProperty({
        description: 'Indicates if the user account is active.',
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
}

class ManagedBranchDto {
    @ApiProperty({
        description: 'The ID of the managed branch.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The name of the managed branch.',
        example: 'Main Branch',
    })
    branchName: string;
}

export class OrganizationUserResponseDto extends UserResponseDto {
    @ApiProperty({
        description: 'The role of the user in the organization.',
        enum: Role,
        example: Role.ADMIN,
    })
    role: Role;

    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'A list of branches managed by the user.',
        type: [ManagedBranchDto],
    })
    managedBranches: ManagedBranchDto[];
}

class UserOrganizationLinkDto {
    @ApiProperty({
        description: 'The ID of the organization.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'The name of the organization.',
        example: 'Acme Corporation',
    })
    organizationName: string;

    @ApiProperty({
        description: 'The role of the user in the organization.',
        enum: Role,
        example: Role.ADMIN,
    })
    role: Role;

    @ApiProperty({
        description: 'A list of branches managed by the user in this organization.',
        type: [ManagedBranchDto],
    })
    managedBranches: ManagedBranchDto[];

    @ApiProperty({
        description: 'The date and time when the user joined the organization.',
        example: '2023-08-14T10:00:00.000Z',
    })
    joinedAt: Date;
}

export class UserWithOrganizationsResponseDto extends UserResponseDto {
    @ApiProperty({
        description: 'A list of organizations the user belongs to.',
        type: [UserOrganizationLinkDto],
    })
    organizations: UserOrganizationLinkDto[];
}
