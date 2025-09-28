import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { ApiKeyGuard, ApiKeyTypes } from './guards/api-key.guard';
import {
    ApiKeyDto,
    SecurityEventDto,
    RateLimitConfigDto,
    IpWhitelistDto,
    SecurityStatsDto,
    ApiKeyType,
    SecurityEventType,
} from './dto/security.dto';

@ApiTags('Security Management')
@Controller('security')
@UseGuards(ApiKeyGuard)
@ApiKeyTypes(ApiKeyType.ADMIN)
@ApiBearerAuth()
export class SecurityController {
    constructor(private readonly securityService: SecurityService) {}

    @Get('stats')
    @ApiOperation({
        summary: 'Get security statistics',
        description: 'Retrieves comprehensive security statistics for monitoring and analysis',
    })
    @ApiQuery({
        name: 'periodHours',
        description: 'Statistics period in hours',
        required: false,
        example: 24,
    })
    @ApiResponse({
        status: 200,
        description: 'Security statistics retrieved successfully',
        type: SecurityStatsDto,
    })
    async getSecurityStats(@Query('periodHours') periodHours?: number): Promise<SecurityStatsDto> {
        return this.securityService.getSecurityStats(
            periodHours ? parseInt(periodHours.toString()) : 24
        );
    }

    @Get('events')
    @ApiOperation({
        summary: 'Get security events',
        description: 'Retrieves recent security events with optional filtering',
    })
    @ApiQuery({
        name: 'limit',
        description: 'Maximum number of events to return',
        required: false,
        example: 100,
    })
    @ApiQuery({
        name: 'eventType',
        description: 'Filter by event type',
        required: false,
        enum: SecurityEventType,
    })
    @ApiResponse({
        status: 200,
        description: 'Security events retrieved successfully',
        type: [SecurityEventDto],
    })
    async getSecurityEvents(
        @Query('limit') limit?: number,
        @Query('eventType') eventType?: SecurityEventType
    ): Promise<SecurityEventDto[]> {
        return this.securityService.getSecurityEvents(
            limit ? parseInt(limit.toString()) : 100,
            eventType
        );
    }

    @Post('events')
    @ApiOperation({
        summary: 'Log security event',
        description: 'Manually log a security event for monitoring and analysis',
    })
    @ApiResponse({
        status: 201,
        description: 'Security event logged successfully',
    })
    async logSecurityEvent(@Body() eventDto: SecurityEventDto): Promise<{ message: string }> {
        await this.securityService.logSecurityEvent(eventDto);
        return { message: 'Security event logged successfully' };
    }

    @Get('api-keys')
    @ApiOperation({
        summary: 'List API keys',
        description: 'Retrieves all API keys with masked values for security',
    })
    @ApiResponse({
        status: 200,
        description: 'API keys retrieved successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    keyId: { type: 'string' },
                    maskedKey: { type: 'string' },
                    type: { type: 'string', enum: Object.values(ApiKeyType) },
                    description: { type: 'string' },
                    allowedIps: { type: 'array', items: { type: 'string' } },
                    rateLimit: { type: 'number' },
                    isActive: { type: 'boolean' },
                    expiresAt: { type: 'string', format: 'date-time' },
                    lastUsed: { type: 'string', format: 'date-time' },
                },
            },
        },
    })
    async listApiKeys() {
        return this.securityService.listApiKeys();
    }

    @Post('api-keys')
    @ApiOperation({
        summary: 'Create API key',
        description: 'Creates a new API key with specified permissions and restrictions',
    })
    @ApiResponse({
        status: 201,
        description: 'API key created successfully',
        schema: {
            type: 'object',
            properties: {
                keyId: { type: 'string' },
                apiKey: { type: 'string' },
                message: { type: 'string' },
            },
        },
    })
    async createApiKey(@Body() keyDto: Partial<ApiKeyDto>) {
        const result = await this.securityService.createApiKey(keyDto);
        return {
            ...result,
            message:
                'API key created successfully. Store this key securely as it cannot be retrieved again.',
        };
    }

    @Put('api-keys/:apiKey')
    @ApiOperation({
        summary: 'Update API key',
        description: 'Updates an existing API key configuration',
    })
    @ApiParam({ name: 'apiKey', description: 'API key to update' })
    @ApiResponse({
        status: 200,
        description: 'API key updated successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'API key not found',
    })
    async updateApiKey(@Param('apiKey') apiKey: string, @Body() updates: Partial<ApiKeyDto>) {
        const updated = await this.securityService.updateApiKey(apiKey, updates);

        if (!updated) {
            return { message: 'API key not found', success: false };
        }

        return { message: 'API key updated successfully', success: true };
    }

    @Delete('api-keys/:apiKey')
    @ApiOperation({
        summary: 'Revoke API key',
        description: 'Revokes an API key, making it invalid for future requests',
    })
    @ApiParam({ name: 'apiKey', description: 'API key to revoke' })
    @ApiResponse({
        status: 200,
        description: 'API key revoked successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'API key not found',
    })
    async revokeApiKey(@Param('apiKey') apiKey: string) {
        const revoked = await this.securityService.revokeApiKey(apiKey);

        if (!revoked) {
            return { message: 'API key not found', success: false };
        }

        return { message: 'API key revoked successfully', success: true };
    }

    @Get('ip-whitelist')
    @ApiOperation({
        summary: 'Get IP whitelist',
        description: 'Retrieves all whitelisted IP addresses and ranges',
    })
    @ApiResponse({
        status: 200,
        description: 'IP whitelist retrieved successfully',
        schema: {
            type: 'array',
            items: { type: 'string' },
        },
    })
    async getWhitelistedIps(): Promise<string[]> {
        return this.securityService.getWhitelistedIps();
    }

    @Post('ip-whitelist')
    @ApiOperation({
        summary: 'Add IP to whitelist',
        description: 'Adds an IP address or CIDR range to the whitelist',
    })
    @ApiResponse({
        status: 201,
        description: 'IP added to whitelist successfully',
    })
    async addIpToWhitelist(@Body() ipDto: IpWhitelistDto) {
        await this.securityService.addIpToWhitelist(ipDto);
        return { message: 'IP added to whitelist successfully' };
    }

    @Delete('ip-whitelist/:ipAddress')
    @ApiOperation({
        summary: 'Remove IP from whitelist',
        description: 'Removes an IP address from the whitelist',
    })
    @ApiParam({ name: 'ipAddress', description: 'IP address to remove from whitelist' })
    @ApiResponse({
        status: 200,
        description: 'IP removed from whitelist successfully',
    })
    @ApiResponse({
        status: 404,
        description: 'IP not found in whitelist',
    })
    async removeIpFromWhitelist(@Param('ipAddress') ipAddress: string) {
        const removed = await this.securityService.removeIpFromWhitelist(ipAddress);

        if (!removed) {
            return { message: 'IP not found in whitelist', success: false };
        }

        return { message: 'IP removed from whitelist successfully', success: true };
    }

    @Get('ip-blocked')
    @ApiOperation({
        summary: 'Get blocked IPs',
        description: 'Retrieves all currently blocked IP addresses',
    })
    @ApiResponse({
        status: 200,
        description: 'Blocked IPs retrieved successfully',
        schema: {
            type: 'array',
            items: { type: 'string' },
        },
    })
    async getBlockedIps(): Promise<string[]> {
        return this.securityService.getBlockedIps();
    }

    @Post('ip-blocked/:ipAddress')
    @ApiOperation({
        summary: 'Block IP address',
        description: 'Manually blocks an IP address with optional duration',
    })
    @ApiParam({ name: 'ipAddress', description: 'IP address to block' })
    @ApiResponse({
        status: 201,
        description: 'IP blocked successfully',
    })
    async blockIp(
        @Param('ipAddress') ipAddress: string,
        @Body() body: { reason: string; duration?: number }
    ) {
        await this.securityService.blockIp(ipAddress, body.reason, body.duration);
        return { message: 'IP blocked successfully' };
    }

    @Delete('ip-blocked/:ipAddress')
    @ApiOperation({
        summary: 'Unblock IP address',
        description: 'Removes an IP address from the blocked list',
    })
    @ApiParam({ name: 'ipAddress', description: 'IP address to unblock' })
    @ApiResponse({
        status: 200,
        description: 'IP unblocked successfully',
    })
    async unblockIp(@Param('ipAddress') ipAddress: string) {
        await this.securityService.unblockIp(ipAddress);
        return { message: 'IP unblocked successfully' };
    }

    @Get('health')
    @ApiKeyTypes(ApiKeyType.ADMIN, ApiKeyType.AGENT, ApiKeyType.HIKVISION)
    @ApiOperation({
        summary: 'Security service health check',
        description: 'Returns the health status of the security service',
    })
    @ApiResponse({
        status: 200,
        description: 'Security service health status',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'healthy' },
                timestamp: { type: 'string', format: 'date-time' },
                activeApiKeys: { type: 'number' },
                whitelistedIps: { type: 'number' },
                blockedIps: { type: 'number' },
                recentEvents: { type: 'number' },
            },
        },
    })
    async getHealth() {
        const apiKeys = await this.securityService.listApiKeys();
        const whitelistedIps = await this.securityService.getWhitelistedIps();
        const blockedIps = await this.securityService.getBlockedIps();
        const recentEvents = await this.securityService.getSecurityEvents(100);

        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            activeApiKeys: apiKeys.filter(key => key.isActive).length,
            whitelistedIps: whitelistedIps.length,
            blockedIps: blockedIps.length,
            recentEvents: recentEvents.length,
        };
    }
}
