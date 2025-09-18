import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, JobsOptions, Queue } from 'bullmq';
import { LoggerService } from '../logger';

export interface QueueJobData {
    [key: string]: any;
}

export interface QueueJobOptions extends JobsOptions {
    priority?: number;
    delay?: number;
    repeat?: {
        pattern?: string;
        every?: number;
    };
}

@Injectable()
export class QueueService {
    constructor(
        @InjectQueue('events') private eventsQueue: Queue,
        @InjectQueue('notifications') private notificationsQueue: Queue,
        @InjectQueue('exports') private exportsQueue: Queue,
        @InjectQueue('system-health') private systemHealthQueue: Queue,
        private readonly logger: LoggerService
    ) {}

    /**
     * Add job to events queue
     */
    async addEventJob(
        jobName: string,
        data: QueueJobData,
        options?: QueueJobOptions
    ): Promise<Job> {
        try {
            const job = await this.eventsQueue.add(jobName, data, {
                ...options,
                attempts: options?.attempts || 3,
                backoff: options?.backoff || {
                    type: 'exponential',
                    delay: 2000,
                },
            });

            this.logger.log(`Event job added: ${jobName}`, {
                jobId: job.id,
                queueName: 'events',
                data,
            });

            return job;
        } catch (error) {
            this.logger.error(`Failed to add event job: ${jobName}`, error, {
                data,
                options,
            });
            throw error;
        }
    }

    /**
     * Add job to notifications queue
     */
    async addNotificationJob(
        jobName: string,
        data: QueueJobData,
        options?: QueueJobOptions
    ): Promise<Job> {
        try {
            const job = await this.notificationsQueue.add(jobName, data, {
                ...options,
                attempts: options?.attempts || 5,
                backoff: options?.backoff || {
                    type: 'exponential',
                    delay: 1000,
                },
            });

            this.logger.log(`Notification job added: ${jobName}`, {
                jobId: job.id,
                queueName: 'notifications',
                data,
            });

            return job;
        } catch (error) {
            this.logger.error(`Failed to add notification job: ${jobName}`, error, {
                data,
                options,
            });
            throw error;
        }
    }

    /**
     * Add job to exports queue
     */
    async addExportJob(
        jobName: string,
        data: QueueJobData,
        options?: QueueJobOptions
    ): Promise<Job> {
        try {
            const job = await this.exportsQueue.add(jobName, data, {
                ...options,
                attempts: options?.attempts || 2,
                backoff: options?.backoff || {
                    type: 'exponential',
                    delay: 5000,
                },
            });

            this.logger.log(`Export job added: ${jobName}`, {
                jobId: job.id,
                queueName: 'exports',
                data,
            });

            return job;
        } catch (error) {
            this.logger.error(`Failed to add export job: ${jobName}`, error, {
                data,
                options,
            });
            throw error;
        }
    }

    /**
     * Add job to system health queue
     */
    async addSystemHealthJob(
        jobName: string,
        data: QueueJobData,
        options?: QueueJobOptions
    ): Promise<Job> {
        try {
            const job = await this.systemHealthQueue.add(jobName, data, {
                ...options,
                attempts: options?.attempts || 1,
                backoff: options?.backoff || {
                    type: 'fixed',
                    delay: 10000,
                },
            });

            this.logger.log(`System health job added: ${jobName}`, {
                jobId: job.id,
                queueName: 'system-health',
                data,
            });

            return job;
        } catch (error) {
            this.logger.error(`Failed to add system health job: ${jobName}`, error, {
                data,
                options,
            });
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats(queueName: string) {
        let queue: Queue;

        switch (queueName) {
            case 'events':
                queue = this.eventsQueue;
                break;
            case 'notifications':
                queue = this.notificationsQueue;
                break;
            case 'exports':
                queue = this.exportsQueue;
                break;
            case 'system-health':
                queue = this.systemHealthQueue;
                break;
            default:
                throw new Error(`Unknown queue: ${queueName}`);
        }

        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(),
            queue.getFailed(),
            queue.getDelayed(),
        ]);

        return {
            name: queueName,
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            delayed: delayed.length,
        };
    }

    /**
     * Get all queue statistics
     */
    async getAllQueueStats() {
        const queueNames = ['events', 'notifications', 'exports', 'system-health'];
        const stats = await Promise.all(queueNames.map(name => this.getQueueStats(name)));

        return stats;
    }

    /**
     * Clean completed jobs from queue
     */
    async cleanQueue(queueName: string, grace: number = 3600000) {
        // 1 hour default
        let queue: Queue;

        switch (queueName) {
            case 'events':
                queue = this.eventsQueue;
                break;
            case 'notifications':
                queue = this.notificationsQueue;
                break;
            case 'exports':
                queue = this.exportsQueue;
                break;
            case 'system-health':
                queue = this.systemHealthQueue;
                break;
            default:
                throw new Error(`Unknown queue: ${queueName}`);
        }

        const cleaned = await queue.clean(grace, 100, 'completed');
        this.logger.log(`Cleaned ${cleaned.length} completed jobs from ${queueName} queue`);

        return cleaned.length;
    }

    /**
     * Retry failed jobs
     */
    async retryFailedJobs(queueName: string) {
        let queue: Queue;

        switch (queueName) {
            case 'events':
                queue = this.eventsQueue;
                break;
            case 'notifications':
                queue = this.notificationsQueue;
                break;
            case 'exports':
                queue = this.exportsQueue;
                break;
            case 'system-health':
                queue = this.systemHealthQueue;
                break;
            default:
                throw new Error(`Unknown queue: ${queueName}`);
        }

        const failedJobs = await queue.getFailed();
        let retriedCount = 0;

        for (const job of failedJobs) {
            try {
                await job.retry();
                retriedCount++;
            } catch (error) {
                this.logger.error(`Failed to retry job ${job.id}`, error);
            }
        }

        this.logger.log(`Retried ${retriedCount} failed jobs from ${queueName} queue`);
        return retriedCount;
    }
}
