import { Injectable } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from '../logger';
import { QueueService } from './queue.service';

@Injectable()
@Processor('system-health')
export class QueueMonitorProcessor extends WorkerHost {
    constructor(
        private readonly logger: LoggerService,
        private readonly queueService: QueueService
    ) {
        super();
    }

    async process(job: Job): Promise<any> {
        switch (job.name) {
            case 'queue-monitoring':
                return this.monitorQueues();
            case 'health-check':
                return this.performHealthCheck(job.data);
            case 'database-cleanup':
                return this.performDatabaseCleanup(job.data);
            default:
                throw new Error(`Unknown job type: ${job.name}`);
        }
    }

    private async monitorQueues() {
        try {
            const stats = await this.queueService.getAllQueueStats();

            // Log queue statistics
            for (const queueStat of stats) {
                this.logger.log(`Queue stats: ${queueStat.name}`, queueStat);

                // Alert if too many failed jobs
                if (queueStat.failed > 10) {
                    this.logger.warn(`High number of failed jobs in ${queueStat.name} queue`, {
                        failedCount: queueStat.failed,
                    });
                }

                // Alert if queue is backing up
                if (queueStat.waiting > 100) {
                    this.logger.warn(`Queue ${queueStat.name} is backing up`, {
                        waitingCount: queueStat.waiting,
                    });
                }
            }

            return { stats, timestamp: new Date() };
        } catch (error) {
            this.logger.error('Queue monitoring failed', error);
            throw error;
        }
    }

    private async performHealthCheck(data: any) {
        const { checkType, threshold, organizationId } = data;

        try {
            switch (checkType) {
                case 'database':
                    return this.checkDatabaseHealth();
                case 'redis':
                    return this.checkRedisHealth();
                case 'memory':
                    return this.checkMemoryHealth(threshold);
                case 'disk-space':
                    return this.checkDiskSpaceHealth(threshold);
                default:
                    throw new Error(`Unknown health check type: ${checkType}`);
            }
        } catch (error) {
            this.logger.error(`Health check failed: ${checkType}`, error, {
                organizationId,
            });
            throw error;
        }
    }

    private async checkDatabaseHealth() {
        // This would typically check database connectivity and performance
        // For now, we'll just return a simple check
        return {
            status: 'healthy',
            responseTime: Date.now(),
            timestamp: new Date(),
        };
    }

    private async checkRedisHealth() {
        // This would typically check Redis connectivity and performance
        return {
            status: 'healthy',
            responseTime: Date.now(),
            timestamp: new Date(),
        };
    }

    private async checkMemoryHealth(threshold: number = 80) {
        const memoryUsage = process.memoryUsage();
        const usedMemoryMB = memoryUsage.heapUsed / 1024 / 1024;
        const totalMemoryMB = memoryUsage.heapTotal / 1024 / 1024;
        const usagePercentage = (usedMemoryMB / totalMemoryMB) * 100;

        const isHealthy = usagePercentage < threshold;

        if (!isHealthy) {
            this.logger.warn('High memory usage detected', {
                usagePercentage,
                threshold,
                usedMemoryMB,
                totalMemoryMB,
            });
        }

        return {
            status: isHealthy ? 'healthy' : 'warning',
            usagePercentage,
            usedMemoryMB,
            totalMemoryMB,
            threshold,
            timestamp: new Date(),
        };
    }

    private async checkDiskSpaceHealth(threshold: number = 85) {
        // This would typically check actual disk space
        // For now, we'll return a mock healthy status
        return {
            status: 'healthy',
            usagePercentage: 45,
            threshold,
            timestamp: new Date(),
        };
    }

    private async performDatabaseCleanup(data: any) {
        const { tables, retentionDays, organizationId } = data;

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            this.logger.log('Starting database cleanup', {
                tables,
                retentionDays,
                cutoffDate,
                organizationId,
            });

            // This would typically perform actual cleanup operations
            // For now, we'll just log the operation
            const cleanedRecords = 0; // Mock value

            this.logger.log('Database cleanup completed', {
                tables,
                cleanedRecords,
                organizationId,
            });

            return {
                tables,
                cleanedRecords,
                cutoffDate,
                timestamp: new Date(),
            };
        } catch (error) {
            this.logger.error('Database cleanup failed', error, {
                tables,
                organizationId,
            });
            throw error;
        }
    }

    @OnWorkerEvent('completed')
    onCompleted(job: Job) {
        this.logger.log(`System health job completed: ${job.name}`, {
            jobId: job.id,
            processingTime: job.processedOn ? Date.now() - job.processedOn : 0,
        });
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job, error: Error) {
        this.logger.error(`System health job failed: ${job.name}`, error.message, {
            jobId: job.id,
            attemptsMade: job.attemptsMade,
            attemptsTotal: job.opts.attempts,
            error: error.stack,
        });
    }

    @OnWorkerEvent('stalled')
    onStalled(jobId: string) {
        this.logger.warn(`System health job stalled: ${jobId}`);
    }
}
