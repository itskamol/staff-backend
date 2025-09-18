import { Injectable } from '@nestjs/common';
import { LoggerService } from '@/core/logger';
import { PrismaService } from '@/core/database/prisma.service';
import { ConfigService } from '@/core/config/config.service';

@Injectable()
export class HealthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
        private readonly logger: LoggerService
    ) {}

    async getHealthStatus() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'sector-staff-v2',
            version: '2.1.0',
            environment: this.config.nodeEnv,
        };
    }

    async getDetailedHealthStatus() {
        const startTime = Date.now();

        try {
            // Check database connectivity
            const dbStatus = await this.checkDatabase();

            // Check Redis connectivity (if needed)
            // const redisStatus = await this.checkRedis();

            const responseTime = Date.now() - startTime;

            const healthStatus = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                service: 'sector-staff-v2',
                version: '2.1.0',
                environment: this.config.nodeEnv,
                responseTime: `${responseTime}ms`,
                checks: {
                    database: dbStatus,
                    // redis: redisStatus,
                },
            };

            this.logger.log('Health check completed', {
                responseTime,
                status: 'ok',
                module: 'health',
            });

            return healthStatus;
        } catch (error) {
            const responseTime = Date.now() - startTime;

            this.logger.error('Health check failed', error.message, {
                responseTime,
                module: 'health',
                error: error.message,
            });

            return {
                status: 'error',
                timestamp: new Date().toISOString(),
                service: 'sector-staff-v2',
                version: '2.1.0',
                environment: this.config.nodeEnv,
                responseTime: `${responseTime}ms`,
                error: error.message,
            };
        }
    }

    private async checkDatabase(): Promise<{ status: string; responseTime?: string }> {
        const startTime = Date.now();

        try {
            // Simple query to check database connectivity
            await this.prisma.$queryRaw`SELECT 1`;

            const responseTime = Date.now() - startTime;

            return {
                status: 'ok',
                responseTime: `${responseTime}ms`,
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            this.logger.error('Database health check failed', error.message, {
                responseTime,
                module: 'health',
                check: 'database',
            });

            return {
                status: 'error',
                responseTime: `${responseTime}ms`,
            };
        }
    }
}
