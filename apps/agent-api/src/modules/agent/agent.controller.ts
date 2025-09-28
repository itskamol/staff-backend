import { Controller, Post, Body, HttpCode, HttpStatus, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '@app/shared/auth';
import { ApiResponseDto } from '@app/shared/utils';
import { ApiKeyGuard, ApiKeyTypes } from '../security/guards/api-key.guard';
import { ApiKeyType } from '../security/dto/security.dto';
import { AgentService } from './agent.service';
import {
    ActiveWindowDto,
    VisitedSiteDto,
    ScreenshotDto,
    UserSessionDto,
    RegisterComputerDto,
    RegisterComputerUserDto,
} from './dto/agent.dto';

@ApiTags('Agent')
@Controller('agent')
@UseGuards(ApiKeyGuard)
@ApiKeyTypes(ApiKeyType.AGENT, ApiKeyType.ADMIN)
@ApiBearerAuth()
export class AgentController {
    constructor(private readonly agentService: AgentService) {}

    @Post('register-computer')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register computer' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'Computer registered successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    async registerComputer(
        @Body() registerComputerDto: RegisterComputerDto,
        @Headers('x-api-key') apiKey: string
    ): Promise<ApiResponseDto> {
        const result = await this.agentService.registerComputer(registerComputerDto, apiKey);
        return ApiResponseDto.success(result, 'Computer registered successfully');
    }

    @Post('register-computer-user')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register computer user' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'Computer user registered successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    async registerComputerUser(
        @Body() registerComputerUserDto: RegisterComputerUserDto,
        @Headers('x-api-key') apiKey: string
    ): Promise<ApiResponseDto> {
        const result = await this.agentService.registerComputerUser(
            registerComputerUserDto,
            apiKey
        );
        return ApiResponseDto.success(result, 'Computer user registered successfully');
    }

    @Post('active-windows')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit active windows data' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'Active windows data received successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    @ApiResponse({ status: 400, description: 'Invalid data format' })
    async submitActiveWindows(
        @Body() activeWindowDto: ActiveWindowDto,
        @Headers('x-api-key') apiKey: string
    ): Promise<ApiResponseDto> {
        await this.agentService.processActiveWindows(activeWindowDto, apiKey);
        return ApiResponseDto.success(null, 'Active windows data received successfully');
    }

    @Post('visited-sites')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit visited sites data' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'Visited sites data received successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    @ApiResponse({ status: 400, description: 'Invalid data format' })
    async submitVisitedSites(
        @Body() visitedSiteDto: VisitedSiteDto,
        @Headers('x-api-key') apiKey: string
    ): Promise<ApiResponseDto> {
        await this.agentService.processVisitedSites(visitedSiteDto, apiKey);
        return ApiResponseDto.success(null, 'Visited sites data received successfully');
    }

    @Post('screenshots')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit screenshot data' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'Screenshot data received successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    @ApiResponse({ status: 400, description: 'Invalid data format' })
    async submitScreenshots(
        @Body() screenshotDto: ScreenshotDto,
        @Headers('x-api-key') apiKey: string
    ): Promise<ApiResponseDto> {
        await this.agentService.processScreenshots(screenshotDto, apiKey);
        return ApiResponseDto.success(null, 'Screenshot data received successfully');
    }

    @Post('user-sessions')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Submit user session data' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'User session data received successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    @ApiResponse({ status: 400, description: 'Invalid data format' })
    async submitUserSessions(
        @Body() userSessionDto: UserSessionDto,
        @Headers('x-api-key') apiKey: string
    ): Promise<ApiResponseDto> {
        await this.agentService.processUserSessions(userSessionDto, apiKey);
        return ApiResponseDto.success(null, 'User session data received successfully');
    }
}
