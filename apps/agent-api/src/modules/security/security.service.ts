import { Injectable, Logger, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import {
    ApiKeyDto,
    SecurityEventDto,
    RateLimitConfigDto,
    IpWhitelistDto,
    SecurityStatsDto,
    ApiKeyType,
    SecurityEventType,
} from './dto/security.dto';
import * as crypto from 'crypto';

interface RateLimitEntry {
    count: number;
    resetTime: number;
    blocked: boolean;
    blockUntil?: number;
}

interface ApiKeyInfo {
    id: string;
    type: ApiKeyType;
    description?: string;
    allowedIps?: string[];
    rateLimit?: number;
    isActive: boolean;
    expiresAt?: string;
    lastUsed?: Date;
}

@Injectable()
export class SecurityService {
    private readonly logger = new Logger(SecurityService.name);
    private readonly rateLimitMap = new Map<string, RateLimitEntry>();
    private readonly apiKeys = new Map<string, ApiKeyInfo>();
    private readonly ipWhitelist = new Set<string>();
    private readonly blockedIps = new Set<string>();
    private readonly securityEvents: SecurityEventDto[] = [];

    // Default rate limits
    private readonly defaultRateLimit = {
        maxRequests: 100,
        windowSeconds: 60,
        burstAllowance: 10,
        blockDurationSeconds: 300, // 5 minutes
    };

    constructor(private readonly prisma: PrismaService) {
        this.initializeDefaultApiKeys();
        this.startCleanupInterval();
    }

    async validateApiKey(
        apiKey: string,
        ipAddress: string,
        userAgent: string
    ): Promise<ApiKeyInfo> {
        // Check if API key exists and is valid
        const keyInfo = this.apiKeys.get(apiKey);

        if (!keyInfo) {
            await this.logSecurityEvent({
                eventType: SecurityEventType.INVALID_API_KEY,
                ipAddress,
                userAgent,
                apiKey,
                severity: 7,
                details: { reason: 'API key not found' },
            });
            throw new UnauthorizedException('Invalid API key');
        }

        if (!keyInfo.isActive) {
            await this.logSecurityEvent({
                eventType: SecurityEventType.INVALID_API_KEY,
                ipAddress,
                userAgent,
                apiKey,
                severity: 6,
                details: { reason: 'API key is inactive' },
            });
            throw new UnauthorizedException('API key is inactive');
        }

        if (keyInfo.expiresAt && new Date(keyInfo.expiresAt) < new Date()) {
            await this.logSecurityEvent({
                eventType: SecurityEventType.INVALID_API_KEY,
                ipAddress,
                userAgent,
                apiKey,
                severity: 5,
                details: { reason: 'API key has expired' },
            });
            throw new UnauthorizedException('API key has expired');
        }

        // Check IP restrictions
        if (keyInfo.allowedIps && keyInfo.allowedIps.length > 0) {
            const isAllowed = keyInfo.allowedIps.some(allowedIp =>
                this.isIpInRange(ipAddress, allowedIp)
            );

            if (!isAllowed) {
                await this.logSecurityEvent({
                    eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
                    ipAddress,
                    userAgent,
                    apiKey,
                    severity: 8,
                    details: { reason: 'IP not in allowed list', allowedIps: keyInfo.allowedIps },
                });
                throw new ForbiddenException('IP address not allowed for this API key');
            }
        }

        // Update last used timestamp
        keyInfo.lastUsed = new Date();

        return keyInfo;
    }

    async checkRateLimit(
        identifier: string,
        ipAddress: string,
        userAgent: string,
        customLimit?: RateLimitConfigDto
    ): Promise<boolean> {
        const config = customLimit || this.defaultRateLimit;
        const now = Date.now();
        const windowStart = now - config.windowSeconds * 1000;

        let entry = this.rateLimitMap.get(identifier);

        if (!entry) {
            entry = {
                count: 0,
                resetTime: now + config.windowSeconds * 1000,
                blocked: false,
            };
            this.rateLimitMap.set(identifier, entry);
        }

        // Check if currently blocked
        if (entry.blocked && entry.blockUntil && now < entry.blockUntil) {
            await this.logSecurityEvent({
                eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
                ipAddress,
                userAgent,
                severity: 6,
                details: {
                    identifier,
                    blockUntil: new Date(entry.blockUntil),
                    reason: 'Currently blocked due to rate limit violation',
                },
            });
            return false;
        }

        // Reset window if expired
        if (now > entry.resetTime) {
            entry.count = 0;
            entry.resetTime = now + config.windowSeconds * 1000;
            entry.blocked = false;
            entry.blockUntil = undefined;
        }

        // Increment counter
        entry.count++;

        // Check if limit exceeded
        if (entry.count > config.maxRequests) {
            entry.blocked = true;
            entry.blockUntil = now + config.blockDurationSeconds * 1000;

            await this.logSecurityEvent({
                eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
                ipAddress,
                userAgent,
                severity: 7,
                details: {
                    identifier,
                    count: entry.count,
                    limit: config.maxRequests,
                    blockDuration: config.blockDurationSeconds,
                },
            });

            return false;
        }

        return true;
    }

    async checkIpWhitelist(ipAddress: string): Promise<boolean> {
        // If no whitelist is configured, allow all IPs
        if (this.ipWhitelist.size === 0) {
            return true;
        }

        for (const allowedIp of this.ipWhitelist) {
            if (this.isIpInRange(ipAddress, allowedIp)) {
                return true;
            }
        }

        return false;
    }

    async isIpBlocked(ipAddress: string): Promise<boolean> {
        return this.blockedIps.has(ipAddress);
    }

    async blockIp(ipAddress: string, reason: string, duration?: number): Promise<void> {
        this.blockedIps.add(ipAddress);

        await this.logSecurityEvent({
            eventType: SecurityEventType.IP_BLOCKED,
            ipAddress,
            userAgent: 'System',
            severity: 8,
            details: { reason, duration },
        });

        // Auto-unblock after duration if specified
        if (duration) {
            setTimeout(() => {
                this.blockedIps.delete(ipAddress);
                this.logger.log(`IP ${ipAddress} automatically unblocked after ${duration}ms`);
            }, duration);
        }

        this.logger.warn(`IP ${ipAddress} blocked: ${reason}`);
    }

    async unblockIp(ipAddress: string): Promise<void> {
        this.blockedIps.delete(ipAddress);
        this.logger.log(`IP ${ipAddress} unblocked`);
    }

    async createApiKey(keyDto: Partial<ApiKeyDto>): Promise<{ keyId: string; apiKey: string }> {
        const keyId = `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const apiKey = this.generateApiKey();

        const keyInfo: ApiKeyInfo = {
            id: keyId,
            type: keyDto.keyType || ApiKeyType.AGENT,
            description: keyDto.description,
            allowedIps: keyDto.allowedIps,
            rateLimit: keyDto.rateLimit,
            isActive: keyDto.isActive !== false,
            expiresAt: keyDto.expiresAt ? keyDto.expiresAt : undefined,
        };

        this.apiKeys.set(apiKey, keyInfo);

        this.logger.log(`API key created: ${keyId} (type: ${keyInfo.type})`);

        return { keyId, apiKey };
    }

    async revokeApiKey(apiKey: string): Promise<boolean> {
        const keyInfo = this.apiKeys.get(apiKey);
        if (keyInfo) {
            this.apiKeys.delete(apiKey);
            this.logger.log(`API key revoked: ${keyInfo.id}`);
            return true;
        }
        return false;
    }

    async updateApiKey(apiKey: string, updates: Partial<ApiKeyInfo>): Promise<boolean> {
        const keyInfo = this.apiKeys.get(apiKey);
        if (keyInfo) {
            Object.assign(keyInfo, updates);
            this.logger.log(`API key updated: ${keyInfo.id}`);
            return true;
        }
        return false;
    }

    async listApiKeys(): Promise<
        Array<Omit<ApiKeyInfo, 'id'> & { keyId: string; maskedKey: string }>
    > {
        const keys: Array<Omit<ApiKeyInfo, 'id'> & { keyId: string; maskedKey: string }> = [];

        for (const [apiKey, keyInfo] of this.apiKeys.entries()) {
            keys.push({
                keyId: keyInfo.id,
                maskedKey: this.maskApiKey(apiKey),
                type: keyInfo.type,
                description: keyInfo.description,
                allowedIps: keyInfo.allowedIps,
                rateLimit: keyInfo.rateLimit,
                isActive: keyInfo.isActive,
                expiresAt: keyInfo.expiresAt,
                lastUsed: keyInfo.lastUsed,
            });
        }

        return keys;
    }

    async addIpToWhitelist(ipDto: IpWhitelistDto): Promise<void> {
        this.ipWhitelist.add(ipDto.ipAddress);
        this.logger.log(
            `IP added to whitelist: ${ipDto.ipAddress} - ${ipDto.description || 'No description'}`
        );
    }

    async removeIpFromWhitelist(ipAddress: string): Promise<boolean> {
        const removed = this.ipWhitelist.delete(ipAddress);
        if (removed) {
            this.logger.log(`IP removed from whitelist: ${ipAddress}`);
        }
        return removed;
    }

    async getWhitelistedIps(): Promise<string[]> {
        return Array.from(this.ipWhitelist);
    }

    async getBlockedIps(): Promise<string[]> {
        return Array.from(this.blockedIps);
    }

    async logSecurityEvent(eventDto: SecurityEventDto): Promise<void> {
        const event = {
            ...eventDto,
            timestamp: new Date().toISOString(),
        };

        this.securityEvents.push(event);

        // Keep only last 10000 events in memory
        if (this.securityEvents.length > 10000) {
            this.securityEvents.splice(0, this.securityEvents.length - 10000);
        }

        // Log high severity events
        if (event.severity && event.severity >= 7) {
            this.logger.warn(
                `Security Event: ${event.eventType} from ${event.ipAddress}`,
                event.details
            );
        } else {
            this.logger.debug(`Security Event: ${event.eventType} from ${event.ipAddress}`);
        }

        // Auto-block IPs with too many security violations
        await this.checkForSuspiciousActivity(eventDto.ipAddress);
    }

    async getSecurityStats(periodHours: number = 24): Promise<SecurityStatsDto> {
        const cutoffTime = new Date(Date.now() - periodHours * 60 * 60 * 1000);
        const recentEvents = this.securityEvents.filter(
            event => new Date(event.timestamp) >= cutoffTime
        );

        const eventsByType: Record<SecurityEventType, number> = {} as any;
        const ipCounts = new Map<string, number>();
        const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            requests: 0,
            blocked: 0,
        }));

        let totalRequests = 0;
        let blockedRequests = 0;
        let rateLimitedRequests = 0;
        let invalidApiKeyAttempts = 0;

        recentEvents.forEach(event => {
            // Count by type
            eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;

            // Count by IP
            ipCounts.set(event.ipAddress, (ipCounts.get(event.ipAddress) || 0) + 1);

            // Count by category
            totalRequests++;

            if (
                event.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED ||
                event.eventType === SecurityEventType.IP_BLOCKED
            ) {
                blockedRequests++;
            }

            if (event.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED) {
                rateLimitedRequests++;
            }

            if (event.eventType === SecurityEventType.INVALID_API_KEY) {
                invalidApiKeyAttempts++;
            }

            // Hourly distribution
            const eventHour = new Date(event.timestamp).getHours();
            hourlyStats[eventHour].requests++;

            if (
                event.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED ||
                event.eventType === SecurityEventType.IP_BLOCKED
            ) {
                hourlyStats[eventHour].blocked++;
            }
        });

        const topBlockedIps = Array.from(ipCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([ip, count]) => ({
                ip,
                count,
                lastSeen:
                    recentEvents
                        .filter(e => e.ipAddress === ip)
                        .sort(
                            (a, b) =>
                                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                        )[0]?.timestamp || new Date().toISOString(),
            }));

        return {
            totalRequests,
            blockedRequests,
            rateLimitedRequests,
            invalidApiKeyAttempts,
            uniqueIpAddresses: ipCounts.size,
            topBlockedIps,
            eventsByType,
            hourlyDistribution: hourlyStats,
        };
    }

    async getSecurityEvents(
        limit: number = 100,
        eventType?: SecurityEventType
    ): Promise<SecurityEventDto[]> {
        let events = [...this.securityEvents];

        if (eventType) {
            events = events.filter(event => event.eventType === eventType);
        }

        return events
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    private initializeDefaultApiKeys(): void {
        // Create default admin API key
        const adminKey = this.generateApiKey();
        this.apiKeys.set(adminKey, {
            id: 'admin-key-default',
            type: ApiKeyType.ADMIN,
            description: 'Default admin API key',
            isActive: true,
            rateLimit: 1000, // Higher limit for admin
        });

        // Create default agent API key
        const agentKey = this.generateApiKey();
        this.apiKeys.set(agentKey, {
            id: 'agent-key-default',
            type: ApiKeyType.AGENT,
            description: 'Default agent API key',
            isActive: true,
            rateLimit: 500,
        });

        // Create default HIKVision API key
        const hikVisionKey = this.generateApiKey();
        this.apiKeys.set(hikVisionKey, {
            id: 'hikvision-key-default',
            type: ApiKeyType.HIKVISION,
            description: 'Default HIKVision API key',
            isActive: true,
            rateLimit: 200,
        });

        this.logger.log('Default API keys initialized');
        this.logger.log(`Admin API Key: ${adminKey}`);
        this.logger.log(`Agent API Key: ${agentKey}`);
        this.logger.log(`HIKVision API Key: ${hikVisionKey}`);
    }

    private generateApiKey(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    private maskApiKey(apiKey: string): string {
        if (apiKey.length <= 8) return '***';
        return apiKey.substring(0, 4) + '***' + apiKey.substring(apiKey.length - 4);
    }

    private isIpInRange(ip: string, range: string): boolean {
        // Simple IP matching - in production, use a proper CIDR library
        if (range.includes('/')) {
            // CIDR notation - simplified implementation
            const [network, prefixLength] = range.split('/');
            // For now, just do exact match - implement proper CIDR matching in production
            return ip === network;
        } else {
            // Exact IP match
            return ip === range;
        }
    }

    private async checkForSuspiciousActivity(ipAddress: string): Promise<void> {
        const recentEvents = this.securityEvents.filter(
            event =>
                event.ipAddress === ipAddress &&
                new Date(event.timestamp) > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        );

        // Block IP if too many security violations
        if (recentEvents.length >= 10) {
            await this.blockIp(ipAddress, 'Suspicious activity detected', 30 * 60 * 1000); // Block for 30 minutes

            await this.logSecurityEvent({
                eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
                ipAddress,
                userAgent: 'System',
                severity: 9,
                details: {
                    reason: 'Too many security violations',
                    eventCount: recentEvents.length,
                    timeWindow: '5 minutes',
                },
            });
        }
    }

    private startCleanupInterval(): void {
        // Clean up old rate limit entries every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.rateLimitMap.entries()) {
                if (now > entry.resetTime && !entry.blocked) {
                    this.rateLimitMap.delete(key);
                }
            }
        }, 5 * 60 * 1000);

        this.logger.log('Security cleanup interval started');
    }
}
