import { Job } from 'bullmq';
import { WorkerHost } from '@nestjs/bullmq';
import { LoggerService } from '../../logger';
import { BaseJobData, JobProcessor, JobResult } from '../interfaces/job.interface';

export abstract class BaseJobProcessor<T extends BaseJobData = BaseJobData>
    extends WorkerHost
    implements JobProcessor<T>
{
    constructor(protected readonly logger: LoggerService) {
        super();
    }

    async process(job: Job<T>): Promise<JobResult> {
        const startTime = Date.now();
        const { id, name, data } = job;

        try {
            this.logger.log(`Processing job: ${name}`, {
                jobId: id,
                organizationId: data.organizationId,
                correlationId: data.correlationId,
            });

            const result = await this.execute(job);
            const processingTime = Date.now() - startTime;

            this.logger.log(`Job completed: ${name}`, {
                jobId: id,
                organizationId: data.organizationId,
                correlationId: data.correlationId,
                processingTime,
            });

            return {
                success: true,
                data: result,
                processingTime,
            };
        } catch (error) {
            const processingTime = Date.now() - startTime;

            this.logger.error(`Job failed: ${name}`, error, {
                jobId: id,
                organizationId: data.organizationId,
                correlationId: data.correlationId,
                processingTime,
                attemptsMade: job.attemptsMade,
                attemptsTotal: job.opts.attempts,
            });

            return {
                success: false,
                error: error.message,
                processingTime,
            };
        }
    }

    protected abstract execute(job: Job<T>): Promise<any>;

    protected async updateProgress(job: Job<T>, progress: number, message?: string) {
        await job.updateProgress(progress);

        if (message) {
            this.logger.log(`Job progress: ${job.name}`, {
                jobId: job.id,
                progress,
                message,
                organizationId: job.data.organizationId,
            });
        }
    }

    protected shouldRetry(error: Error, attemptsMade: number, maxAttempts: number): boolean {
        // Don't retry validation errors or business logic errors
        if (error.name === 'ValidationError' || error.name === 'BadRequestException') {
            return false;
        }

        // Don't retry if we've reached max attempts
        if (attemptsMade >= maxAttempts) {
            return false;
        }

        // Retry for network errors, database connection issues, etc.
        return true;
    }

    protected getRetryDelay(attemptsMade: number): number {
        // Exponential backoff: 2^attempt * 1000ms
        return Math.min(Math.pow(2, attemptsMade) * 1000, 30000); // Max 30 seconds
    }
}
