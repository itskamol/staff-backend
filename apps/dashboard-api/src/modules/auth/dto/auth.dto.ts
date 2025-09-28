import { IsString, IsNotEmpty, MinLength, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({
        description: 'User email address for login',
        example: 'john.doe@company.com',
        format: 'email',
    })
    @IsEmail()
    @IsNotEmpty()
    username: string;

    @ApiProperty({
        description: 'User password (at least 6 characters)',
        example: 'Str0ngP@ssw0rd',
        minLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}

export class RefreshTokenDto {
    @ApiProperty({
        description: 'Valid refresh token for re-issuing an access token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}
