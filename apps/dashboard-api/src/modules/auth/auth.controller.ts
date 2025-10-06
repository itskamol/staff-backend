import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ApiSuccessResponse } from '../../shared/dto';
import { LoginDto, LoginResponseDto, LogoutDto, RefreshTokenDto, RefreshTokenResponseDto } from './dto';
import { Public, User } from '@app/shared/auth';
import { ApiErrorResponses, ApiOkResponseData } from '../../shared/utils';
import { UserContext } from '../../shared/interfaces';

export class ValidateTokenResponseDto {
    @ApiProperty({ description: 'Whether the token is valid', example: true })
    valid: boolean;
    
    @ApiProperty({ description: 'User information from token', required: false })
    user?: {
        sub: string;
        username: string;
        role: string;
        organizationId?: number;
    };
}

@ApiTags('Authentication')
@Controller('auth')
@ApiExtraModels(
    ApiSuccessResponse,
    LoginResponseDto,
    RefreshTokenResponseDto,
    ValidateTokenResponseDto
)
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('login')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOkResponseData(LoginResponseDto, { 
        body: LoginDto, 
        summary: 'Log in a user' 
    })
    @ApiErrorResponses({ unauthorized: true, badRequest: true })
    async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
        return this.authService.login(loginDto);
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOkResponseData(RefreshTokenResponseDto, { 
        body: RefreshTokenDto, 
        summary: 'Refresh an access token' 
    })
    @ApiErrorResponses({ unauthorized: true, badRequest: true })
    async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
        return this.authService.refreshToken(refreshTokenDto);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Log out a user' })
    @ApiBody({ type: LogoutDto })
    @ApiResponse({ status: 204, description: 'Logout successful' })
    @ApiErrorResponses({ unauthorized: true })
    async logout(@Body() logoutDto: LogoutDto): Promise<void> {
        await this.authService.logout(logoutDto.refreshToken);
    }

    @Post('validate')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOkResponseData(ValidateTokenResponseDto, { 
        summary: 'Validate the current access token' 
    })
    @ApiErrorResponses({ unauthorized: true })
    async validateToken(@User() user: UserContext): Promise<ValidateTokenResponseDto> {
        const data: ValidateTokenResponseDto = {
            valid: true,
            user: {
                sub: user.sub,
                username: user.username,
                role: user.role,
                organizationId: user.organizationId,
            },
        };

        return data;
    }
}
