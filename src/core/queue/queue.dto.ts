import { ApiProperty } from '@nestjs/swagger';

class QueueStatsDto {
    @ApiProperty({
        description: 'The name of the queue.',
        example: 'default',
    })
    name: string;

    @ApiProperty({
        description: 'The number of waiting jobs in the queue.',
        example: 10,
    })
    waiting: number;

    @ApiProperty({
        description: 'The number of active jobs in the queue.',
        example: 2,
    })
    active: number;

    @ApiProperty({
        description: 'The number of completed jobs in the queue.',
        example: 100,
    })
    completed: number;

    @ApiProperty({
        description: 'The number of failed jobs in the queue.',
        example: 1,
    })
    failed: number;

    @ApiProperty({
        description: 'The number of delayed jobs in the queue.',
        example: 5,
    })
    delayed: number;
}

export class QueueStatsResponseDto {
    @ApiProperty({
        description: 'A list of queue statistics.',
        type: [QueueStatsDto],
    })
    queues: QueueStatsDto[];
}

export class CleanQueueResponseDto {
    @ApiProperty({
        description: 'The name of the cleaned queue.',
        example: 'default',
    })
    queueName: string;

    @ApiProperty({
        description: 'The number of cleaned jobs.',
        example: 5,
    })
    cleanedCount: number;

    @ApiProperty({
        description: 'The timestamp of the clean operation.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;
}

export class RetryFailedJobsResponseDto {
    @ApiProperty({
        description: 'The name of the queue where jobs were retried.',
        example: 'default',
    })
    queueName: string;

    @ApiProperty({
        description: 'The number of retried jobs.',
        example: 1,
    })
    retriedCount: number;

    @ApiProperty({
        description: 'The timestamp of the retry operation.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;
}

export class TriggerJobResponseDto {
    @ApiProperty({
        description: 'The ID of the scheduled job.',
        example: '123',
    })
    jobId: string;

    @ApiProperty({
        description: 'A message indicating the result of the operation.',
        example: 'Health check scheduled',
    })
    message: string;

    @ApiProperty({
        description: 'The timestamp of the operation.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;
}

export class QueueHealthResponseDto {
    @ApiProperty({
        description: 'The health status of the queues.',
        example: 'healthy',
    })
    status: string;

    @ApiProperty({
        description: 'A list of queue statistics.',
        type: [QueueStatsDto],
    })
    queues: QueueStatsDto[];

    @ApiProperty({
        description: 'The total number of failed jobs across all queues.',
        example: 1,
    })
    totalFailed: number;

    @ApiProperty({
        description: 'The total number of waiting jobs across all queues.',
        example: 10,
    })
    totalWaiting: number;

    @ApiProperty({
        description: 'The timestamp of the health check.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: Date;

    @ApiProperty({
        description: 'An error message if the health check failed.',
        example: 'Redis connection failed',
        required: false,
    })
    error?: string;
}
