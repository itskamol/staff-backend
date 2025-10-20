import { Controller, Post, Body, HttpCode, HttpStatus, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBearerAuth } from '@nestjs/swagger';
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

    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register computer' })
    @ApiHeader({ name: 'x-api-key', description: 'Agent API Key' })
    @ApiResponse({ status: 200, description: 'Computer registered successfully' })
    @ApiResponse({ status: 401, description: 'Invalid API key' })
    async registerComputer(
        @Body() registerComputerDto: RegisterComputerDto,
        @Headers('x-api-key') apiKey: string
    ) {
        const result = await this.agentService.registerComputer(registerComputerDto, apiKey);
        return result
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
    ) {
        const result = await this.agentService.registerComputerUser(
            registerComputerUserDto,
            apiKey
        );
        return result
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
    ) {
        return await this.agentService.processActiveWindows(activeWindowDto, apiKey);
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
    ) {
        return await this.agentService.processVisitedSites(visitedSiteDto, apiKey);
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
    ) {
    
        return await this.agentService.processScreenshots(screenshotDto, apiKey);
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
    ) {
        return await this.agentService.processUserSessions(userSessionDto, apiKey);
    }
}
