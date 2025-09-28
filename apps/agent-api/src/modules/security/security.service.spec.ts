import { Test, TestingModule } from '@nestjs/testing';
import { SecurityService } from './security.service';
import { PrismaService } from '@app/shared/database';
import { ApiKeyType, SecurityEventType } from './dto/security.dto';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';

describe('SecurityService', () => {
    let service: SecurityService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        // Add any database operations if needed
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SecurityService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<SecurityService>(SecurityService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createApiKey', () => {
        it('should create a new API key', async () => {
            const keyDto = {
                keyType: ApiKeyType.AGENT,
                description: 'Test API key',
                rateLimit: 100,
            };

            const result = await service.createApiKey(keyDto);

            expect(result.keyId).toBeDefined();
            expect(result.apiKey).toBeDefined();
            expect(result.apiKey).toHaveLength(64); // 32 bytes * 2 (hex)
        });

        it('should create API key with default values', async () => {
            const result = await service.createApiKey({});

            expect(result.keyId).toBeDefined();
            expect(result.apiKey).toBeDefined();
        });
    });

    describe('validateApiKey', () => {
        it('should validate a valid API key', async () => {
            const keyDto = {
                keyType: ApiKeyType.AGENT,
                description: 'Test key',
                isActive: true,
            };

            const { apiKey } = await service.createApiKey(keyDto);
            const result = await service.validateApiKey(apiKey, '192.168.1.1', 'Test Agent');

            expect(result.type).toBe(ApiKeyType.AGENT);
            expect(result.isActive).toBe(true);
            expect(result.lastUsed).toBeDefined();
        });

        it('should throw UnauthorizedException for invalid API key', async () => {
            await expect(
                service.validateApiKey('invalid-key', '192.168.1.1', 'Test Agent')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException for inactive API key', async () => {
            const { apiKey } = await service.createApiKey({
                keyType: ApiKeyType.AGENT,
                isActive: false,
            });

            await expect(
                service.validateApiKey(apiKey, '192.168.1.1', 'Test Agent')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should throw ForbiddenException for IP not in allowed list', async () => {
            const { apiKey } = await service.createApiKey({
                keyType: ApiKeyType.AGENT,
                allowedIps: ['192.168.1.100'],
            });

            await expect(
                service.validateApiKey(apiKey, '192.168.1.1', 'Test Agent')
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('checkRateLimit', () => {
        it('should allow requests within rate limit', async () => {
            const identifier = 'test-user';
            const config = {
                maxRequests: 5,
                windowSeconds: 60,
                burstAllowance: 1,
                blockDurationSeconds: 300,
            };

            for (let i = 0; i < 5; i++) {
                const result = await service.checkRateLimit(
                    identifier,
                    '192.168.1.1',
                    'Test Agent',
                    config
                );
                expect(result).toBe(true);
            }
        });

        it('should block requests exceeding rate limit', async () => {
            const identifier = 'test-user-2';
            const config = {
                maxRequests: 2,
                windowSeconds: 60,
                burstAllowance: 0,
                blockDurationSeconds: 300,
            };

            // First 2 requests should pass
            await service.checkRateLimit(identifier, '192.168.1.1', 'Test Agent', config);
            await service.checkRateLimit(identifier, '192.168.1.1', 'Test Agent', config);

            // Third request should fail
            const result = await service.checkRateLimit(
                identifier,
                '192.168.1.1',
                'Test Agent',
                config
            );
            expect(result).toBe(false);
        });
    });

    describe('IP management', () => {
        it('should add and check IP whitelist', async () => {
            await service.addIpToWhitelist({
                ipAddress: '192.168.1.100',
                description: 'Test IP',
            });

            const isWhitelisted = await service.checkIpWhitelist('192.168.1.100');
            expect(isWhitelisted).toBe(true);

            const notWhitelisted = await service.checkIpWhitelist('192.168.1.1');
            expect(notWhitelisted).toBe(false);
        });

        it('should block and unblock IPs', async () => {
            const testIp = '192.168.1.200';

            await service.blockIp(testIp, 'Test block');

            const isBlocked = await service.isIpBlocked(testIp);
            expect(isBlocked).toBe(true);

            await service.unblockIp(testIp);

            const isStillBlocked = await service.isIpBlocked(testIp);
            expect(isStillBlocked).toBe(false);
        });

        it('should auto-unblock IP after duration', async () => {
            const testIp = '192.168.1.201';
            const blockDuration = 100; // 100ms

            await service.blockIp(testIp, 'Test auto-unblock', blockDuration);

            expect(await service.isIpBlocked(testIp)).toBe(true);

            // Wait for auto-unblock
            await new Promise(resolve => setTimeout(resolve, blockDuration + 50));

            expect(await service.isIpBlocked(testIp)).toBe(false);
        });
    });

    describe('security events', () => {
        it('should log security events', async () => {
            const eventDto = {
                eventType: SecurityEventType.INVALID_API_KEY,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
                severity: 5,
                details: { test: 'data' },
            };

            await service.logSecurityEvent(eventDto);

            const events = await service.getSecurityEvents(10);
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].eventType).toBe(SecurityEventType.INVALID_API_KEY);
        });

        it('should filter events by type', async () => {
            await service.logSecurityEvent({
                eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
            });

            await service.logSecurityEvent({
                eventType: SecurityEventType.INVALID_API_KEY,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
            });

            const rateLimitEvents = await service.getSecurityEvents(
                10,
                SecurityEventType.RATE_LIMIT_EXCEEDED
            );
            const invalidKeyEvents = await service.getSecurityEvents(
                10,
                SecurityEventType.INVALID_API_KEY
            );

            expect(
                rateLimitEvents.every(e => e.eventType === SecurityEventType.RATE_LIMIT_EXCEEDED)
            ).toBe(true);
            expect(
                invalidKeyEvents.every(e => e.eventType === SecurityEventType.INVALID_API_KEY)
            ).toBe(true);
        });
    });

    describe('API key management', () => {
        it('should list API keys with masked values', async () => {
            const { apiKey } = await service.createApiKey({
                keyType: ApiKeyType.AGENT,
                description: 'Test key for listing',
            });

            const keys = await service.listApiKeys();
            const testKey = keys.find(k => k.description === 'Test key for listing');

            expect(testKey).toBeDefined();
            expect(testKey?.maskedKey).toMatch(/^.{4}\*\*\*.{4}$/);
            expect(testKey?.maskedKey).not.toBe(apiKey);
        });

        it('should revoke API key', async () => {
            const { apiKey } = await service.createApiKey({
                keyType: ApiKeyType.AGENT,
            });

            const revoked = await service.revokeApiKey(apiKey);
            expect(revoked).toBe(true);

            await expect(
                service.validateApiKey(apiKey, '192.168.1.1', 'Test Agent')
            ).rejects.toThrow(UnauthorizedException);
        });

        it('should update API key', async () => {
            const { apiKey } = await service.createApiKey({
                keyType: ApiKeyType.AGENT,
                description: 'Original description',
            });

            const updated = await service.updateApiKey(apiKey, {
                description: 'Updated description',
                rateLimit: 200,
            });

            expect(updated).toBe(true);

            const keyInfo = await service.validateApiKey(apiKey, '192.168.1.1', 'Test Agent');
            expect(keyInfo.description).toBe('Updated description');
            expect(keyInfo.rateLimit).toBe(200);
        });
    });

    describe('security statistics', () => {
        it('should generate security statistics', async () => {
            // Generate some test events
            await service.logSecurityEvent({
                eventType: SecurityEventType.INVALID_API_KEY,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
            });

            await service.logSecurityEvent({
                eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
                ipAddress: '192.168.1.2',
                userAgent: 'Test Agent',
            });

            const stats = await service.getSecurityStats(1); // Last 1 hour

            expect(stats.totalRequests).toBeGreaterThan(0);
            expect(stats.uniqueIpAddresses).toBeGreaterThan(0);
            expect(stats.eventsByType).toBeDefined();
            expect(stats.hourlyDistribution).toHaveLength(24);
        });
    });
});
