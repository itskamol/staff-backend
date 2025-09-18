import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public, User } from '@/shared/decorators';
import { UserContext } from '@/shared/interfaces';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    LoginDto,
    LoginResponseDto,
    LogoutDto,
    RefreshTokenDto,
    RefreshTokenResponseDto,
    ValidateTokenResponseDto,
} from '@/shared/dto';
import { ApiOkResponseData } from '@/shared/utils';

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
    @ApiOperation({ summary: 'Log in a user' })
    @ApiBody({ type: LoginDto })
    @ApiOkResponseData(LoginResponseDto)
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorResponse })
    async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
        return this.authService.login(loginDto);
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Refresh an access token' })
    @ApiBody({ type: RefreshTokenDto })
    @ApiOkResponseData(RefreshTokenResponseDto)
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorResponse })
    async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
        return this.authService.refreshToken(refreshTokenDto);
    }

    @Post('logout')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Log out a user' })
    @ApiBody({ type: LogoutDto })
    @ApiResponse({ status: 204, description: 'Logout successful' })
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorResponse })
    async logout(@Body() logoutDto: LogoutDto): Promise<void> {
        await this.authService.logout(logoutDto.refreshToken);
    }

    @Post('validate')
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Validate the current access token' })
    @ApiOkResponseData(ValidateTokenResponseDto)
    @ApiResponse({ status: 401, description: 'Unauthorized', type: ApiErrorResponse })
    async validateToken(@User() user: UserContext): Promise<ValidateTokenResponseDto> {
        const data: ValidateTokenResponseDto = {
            valid: true,
            user: {
                id: +user.sub,
                username: user.username,
                role: user.role,
            },
        };

        return data;
    }
}
