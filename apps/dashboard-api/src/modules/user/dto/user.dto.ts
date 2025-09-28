import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsEnum,
    IsBoolean,
    MinLength,
    IsInt,
    IsEmail,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Role } from '@app/shared/auth';

export class CreateUserDto {
    @ApiProperty({ description: "User's full name", example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        description: "User's email address (used for login)",
        example: 'john.doe@example.com',
        format: 'email',
    })
    @IsEmail()
    @IsNotEmpty()
    username: string;

    @ApiProperty({
        description: "User's password (at least 6 characters)",
        example: 'Str0ngP@ssw0rd',
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;

    @ApiProperty({ description: "User's role", enum: Role, example: Role.HR })
    @IsEnum(Role)
    role: Role;

    @ApiProperty({
        description: 'ID of the organization the user belongs to',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsInt()
    organizationId?: number;

    @ApiProperty({
        description: 'Set user as active or inactive',
        example: true,
        default: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @ApiProperty({
        description: 'New password for the user (at least 6 characters)',
        example: 'NewS3cureP@ss!',
        required: false,
        minLength: 6,
    })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;
}
