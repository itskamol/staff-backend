import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({
        description: 'The email address of the user.',
        example: 'admin',
    })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({
        description: 'The password for the user account.',
        example: 'admin',
    })
    @IsString()
    @IsNotEmpty()
    password: string;
}

export class RefreshTokenDto {
    @ApiProperty({
        description: 'The refresh token used to obtain a new access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

export class LogoutDto {
    @ApiProperty({
        description: 'The refresh token to be invalidated.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

class UserLoginResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the user.',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'The username of the user.',
        example: 'john.doe@example.com',
    })
    username: string;

    @ApiProperty({
        description: 'The full name of the user.',
        example: 'John Doe',
        required: false,
    })
    name: string;

    @ApiProperty({
        description: 'The role of the user.',
        example: 'ADMIN',
    })
    role: string;
}

export class LoginResponseDto {
    @ApiProperty({
        description: 'The JWT access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'The refresh token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refreshToken: string;

    @ApiProperty({
        description: 'The authenticated user details.',
        type: UserLoginResponseDto,
    })
    user: UserLoginResponseDto;
}

export class RefreshTokenResponseDto {
    @ApiProperty({
        description: 'The new JWT access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    accessToken: string;

    @ApiProperty({
        description: 'The new refresh token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    refreshToken: string;
}

class ValidateTokenUserResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the user.',
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'The email address of the user.',
        example: 'john.doe@example.com',
    })
    username: string;

    @ApiProperty({
        description: 'The role of the user.',
        example: 'ADMIN',
    })
    role: string;
}

export class ValidateTokenResponseDto {
    @ApiProperty({
        description: 'Indicates if the token is valid.',
        example: true,
    })
    valid: boolean;

    @ApiProperty({
        description: 'The user details associated with the token.',
        type: ValidateTokenUserResponseDto,
    })
    user: ValidateTokenUserResponseDto;
}
