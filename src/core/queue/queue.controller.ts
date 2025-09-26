import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueProducer } from './queue.producer';
import { Roles, Public } from '@/shared/decorators';
import { Role } from '@prisma/client';
import {
    ApiBearerAuth,
    ApiBody,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    CleanQueueResponseDto,
    QueueHealthResponseDto,
    QueueStatsResponseDto,
    RetryFailedJobsResponseDto,
    TriggerJobResponseDto,
} from './queue.dto';
import { plainToClass } from 'class-transformer';
import { ErrorResponseDto } from '@/shared/dto';
import { ApiOkResponseData, ApiErrorResponses } from '@/shared/utils';

@ApiTags('Admin - Queues')
@ApiBearerAuth()
@Controller('admin/queues')
export class QueueController {
    constructor(
        private readonly queueService: QueueService,
        private readonly queueProducer: QueueProducer
    ) {}

    @Get('stats')
    @Roles(Role.ADMIN)
    @ApiOkResponseData(QueueStatsResponseDto, { 
        summary: 'Get statistics for all queues' 
    })
    @ApiErrorResponses({ forbidden: true })
    async getQueueStats(): Promise<QueueStatsResponseDto> {
        const stats = await this.queueService.getAllQueueStats();
        return { queues: stats };
    }

    @Get(':queueName/stats')
    @Roles(Role.ADMIN)
    @ApiParam({ name: 'queueName', description: 'The name of the queue' })
    @ApiOkResponseData(QueueStatsResponseDto, { 
        summary: 'Get statistics for a specific queue' 
    })
    @ApiErrorResponses({ forbidden: true })
    async getQueueStatsByName(
        @Param('queueName') queueName: string
    ): Promise<QueueStatsResponseDto> {
        const stats = await this.queueService.getQueueStats(queueName);
        return { queues: [stats] };
    }

    @Post(':queueName/clean')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Clean a queue' })
    @ApiParam({ name: 'queueName', description: 'The name of the queue to clean' })
    @ApiQuery({
        name: 'grace',
        description: 'The grace period in milliseconds',
        required: false,
    })
    @ApiResponse({
        status: 200,
        description: 'The result of the clean operation.',
        type: CleanQueueResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async cleanQueue(
        @Param('queueName') queueName: string,
        @Query('grace') grace?: number
    ): Promise<CleanQueueResponseDto> {
        const cleanedCount = await this.queueService.cleanQueue(
            queueName,
            grace ? parseInt(grace.toString()) : undefined
        );

        return {
            queueName,
            cleanedCount,
            timestamp: new Date(),
        };
    }

    @Post(':queueName/retry-failed')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Retry all failed jobs in a queue' })
    @ApiParam({ name: 'queueName', description: 'The name of the queue' })
    @ApiResponse({
        status: 200,
        description: 'The result of the retry operation.',
        type: RetryFailedJobsResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async retryFailedJobs(
        @Param('queueName') queueName: string
    ): Promise<RetryFailedJobsResponseDto> {
        const retriedCount = await this.queueService.retryFailedJobs(queueName);

        return {
            queueName,
            retriedCount,
            timestamp: new Date(),
        };
    }

    @Post('health-check')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger a health check job' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: { checkType: { type: 'string', example: 'database' } },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'The result of the trigger operation.',
        type: TriggerJobResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async triggerHealthCheck(@Body('checkType') checkType: string): Promise<TriggerJobResponseDto> {
        const allowedTypes = ['database', 'redis', 'external-api', 'disk-space', 'memory'] as const;
        if (!allowedTypes.includes(checkType as any)) {
            throw new Error(`Invalid checkType: ${checkType}`);
        }
        const job = await this.queueProducer.scheduleHealthCheck({
            checkType: checkType as (typeof allowedTypes)[number],
        });

        return {
            jobId: String(job.id),
            message: 'Health check scheduled',
            timestamp: new Date(),
        };
    }

    @Post('monitoring')
    @Roles(Role.ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger a queue monitoring job' })
    @ApiResponse({
        status: 200,
        description: 'The result of the trigger operation.',
        type: TriggerJobResponseDto,
    })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ErrorResponseDto })
    async triggerQueueMonitoring(): Promise<TriggerJobResponseDto> {
        const job = await this.queueProducer.scheduleQueueMonitoring();

        return {
            jobId: String(job.id),
            message: 'Queue monitoring scheduled',
            timestamp: new Date(),
        };
    }

    @Get('health')
    @Public()
    @ApiOkResponseData(QueueHealthResponseDto, { 
        summary: 'Get the health status of all queues' 
    })
    async getQueueHealth(): Promise<QueueHealthResponseDto> {
        try {
            const stats = await this.queueService.getAllQueueStats();

            const totalFailed = stats.reduce((sum, stat) => sum + stat.failed, 0);
            const totalWaiting = stats.reduce((sum, stat) => sum + stat.waiting, 0);

            const isHealthy = totalFailed < 50 && totalWaiting < 500;

            return plainToClass(QueueHealthResponseDto, {
                status: isHealthy ? 'healthy' : 'degraded',
                queues: stats,
                totalFailed,
                totalWaiting,
                timestamp: new Date(),
            });
        } catch (error) {
            return plainToClass(QueueHealthResponseDto, {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date(),
            });
        }
    }
}
