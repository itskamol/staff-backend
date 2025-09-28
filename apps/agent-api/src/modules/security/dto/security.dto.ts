import {
    IsString,
    IsOptional,
    IsEnum,
    IsNumber,
    IsObject,
    IsArray,
    IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ApiKeyType {
    AGENT = 'AGENT',
    HIKVISION = 'HIKVISION',
    ADMIN = 'ADMIN',
}

export enum SecurityEventType {
    INVALID_API_KEY = 'INVALID_API_KEY',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    DATA_VALIDATION_FAILED = 'DATA_VALIDATION_FAILED',
    IP_BLOCKED = 'IP_BLOCKED',
}

export class ApiKeyDto {
    @ApiProperty({ description: 'API key identifier' })
    @IsString()
    keyId: string;

    @ApiProperty({ description: 'API key value' })
    @IsString()
    apiKey: string;

    @ApiProperty({
        description: 'Type of API key',
        enum: ApiKeyType,
        example: ApiKeyType.AGENT,
    })
    @IsEnum(ApiKeyType)
    keyType: ApiKeyType;

    @ApiPropertyOptional({ description: 'Description of the API key' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'IP addresses allowed to use this key' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowedIps?: string[];

    @ApiPropertyOptional({ description: 'Rate limit per minute' })
    @IsOptional()
    @IsNumber()
    rateLimit?: number;

    @ApiPropertyOptional({ description: 'Whether the key is active' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiPropertyOptional({ description: 'Key expiration date' })
    @IsOptional()
    @IsString()
    expiresAt?: string;
}

export class SecurityEventDto {
    @ApiProperty({
        description: 'Type of security event',
        enum: SecurityEventType,
        example: SecurityEventType.INVALID_API_KEY,
    })
    @IsEnum(SecurityEventType)
    eventType: SecurityEventType;

    @ApiProperty({ description: 'IP address of the request' })
    @IsString()
    ipAddress: string;

    @ApiProperty({ description: 'User agent string' })
    @IsString()
    userAgent: string;

    @ApiPropertyOptional({ description: 'API key used (if any)' })
    @IsOptional()
    @IsString()
    apiKey?: string;

    @ApiPropertyOptional({ description: 'Request path' })
    @IsOptional()
    @IsString()
    requestPath?: string;

    @ApiPropertyOptional({ description: 'Request method' })
    @IsOptional()
    @IsString()
    requestMethod?: string;

    @ApiPropertyOptional({ description: 'Additional event details' })
    @IsOptional()
    @IsObject()
    details?: any;

    @ApiPropertyOptional({ description: 'Severity level (1-10)' })
    @IsOptional()
    @IsNumber()
    severity?: number;

    timestamp?: string;
}

export class RateLimitConfigDto {
    @ApiProperty({ description: 'Maximum requests per window' })
    @IsNumber()
    maxRequests: number;

    @ApiProperty({ description: 'Time window in seconds' })
    @IsNumber()
    windowSeconds: number;

    @ApiPropertyOptional({ description: 'Burst allowance' })
    @IsOptional()
    @IsNumber()
    burstAllowance?: number;

    @ApiPropertyOptional({ description: 'Block duration in seconds when limit exceeded' })
    @IsOptional()
    @IsNumber()
    blockDurationSeconds?: number;
}

export class IpWhitelistDto {
    @ApiProperty({ description: 'IP address or CIDR range' })
    @IsString()
    ipAddress: string;

    @ApiPropertyOptional({ description: 'Description of the IP/range' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Whether the entry is active' })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class SecurityStatsDto {
    @ApiProperty({ description: 'Total requests in period' })
    @IsNumber()
    totalRequests: number;

    @ApiProperty({ description: 'Blocked requests' })
    @IsNumber()
    blockedRequests: number;

    @ApiProperty({ description: 'Rate limited requests' })
    @IsNumber()
    rateLimitedRequests: number;

    @ApiProperty({ description: 'Invalid API key attempts' })
    @IsNumber()
    invalidApiKeyAttempts: number;

    @ApiProperty({ description: 'Unique IP addresses' })
    @IsNumber()
    uniqueIpAddresses: number;

    @ApiProperty({ description: 'Top blocked IPs' })
    @IsArray()
    topBlockedIps: Array<{
        ip: string;
        count: number;
        lastSeen: string;
    }>;

    @ApiProperty({ description: 'Security events by type' })
    @IsObject()
    eventsByType: Record<SecurityEventType, number>;

    @ApiProperty({ description: 'Hourly request distribution' })
    @IsArray()
    hourlyDistribution: Array<{
        hour: number;
        requests: number;
        blocked: number;
    }>;
}
