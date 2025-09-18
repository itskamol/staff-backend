import { Job } from 'bullmq';

export interface BaseJobData {
    organizationId: string;
    correlationId?: string;
    timestamp?: Date;
}

export interface JobProcessor<T extends BaseJobData = BaseJobData> {
    process(job: Job<T>): Promise<any>;
}

export interface JobResult {
    success: boolean;
    data?: any;
    error?: string;
    processingTime?: number;
}

export interface RetryableJobData extends BaseJobData {
    retryCount?: number;
    maxRetries?: number;
    retryDelay?: number;
}

export interface PriorityJobData extends BaseJobData {
    priority: number;
}

export interface DelayedJobData extends BaseJobData {
    executeAt: Date;
}

export interface RecurringJobData extends BaseJobData {
    cronPattern: string;
    timezone?: string;
}
