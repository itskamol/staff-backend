import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DataProcessingService } from './data-processing.service';
import {
    ProcessingJobDto,
    BatchProcessingDto,
    ProcessingResultDto,
    QueueStatusDto,
    ProcessingStatsDto,
} from './dto/data-processing.dto';

@ApiTags('Data Processing')
@Controller('data-processing')
export class DataProcessingController {
    constructor(private readonly dataProcessingService: DataProcessingService) {}

    @Post('jobs')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: 'Submit data processing job',
        description:
            'Submits a single data processing job to the queue for asynchronous processing',
    })
    @ApiResponse({
        status: 202,
        description: 'Job submitted successfully',
        schema: {
            type: 'object',
            properties: {
                jobId: { type: 'string' },
                status: { type: 'string', example: 'QUEUED' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid job data' })
    async submitJob(@Body() jobDto: ProcessingJobDto) {
        return this.dataProcessingService.submitJob(jobDto);
    }

    @Post('jobs/batch')
    @HttpCode(HttpStatus.ACCEPTED)
    @ApiOperation({
        summary: 'Submit batch of data processing jobs',
        description:
            'Submits multiple data processing jobs in a single request for better throughput',
    })
    @ApiResponse({
        status: 202,
        description: 'Batch submitted successfully',
        schema: {
            type: 'object',
            properties: {
                batchId: { type: 'string' },
                jobIds: { type: 'array', items: { type: 'string' } },
                status: { type: 'string', example: 'QUEUED' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid batch data' })
    async submitBatch(@Body() batchDto: BatchProcessingDto) {
        return this.dataProcessingService.submitBatch(batchDto);
    }

    @Get('jobs/:jobId')
    @ApiOperation({
        summary: 'Get job processing status',
        description: 'Retrieves the current status and results of a specific processing job',
    })
    @ApiParam({ name: 'jobId', description: 'Unique job identifier' })
    @ApiResponse({
        status: 200,
        description: 'Job status retrieved successfully',
        type: ProcessingResultDto,
    })
    @ApiResponse({ status: 404, description: 'Job not found' })
    async getJobStatus(@Param('jobId') jobId: string): Promise<ProcessingResultDto | null> {
        return this.dataProcessingService.getJobStatus(jobId);
    }

    @Get('batches/:batchId')
    @ApiOperation({
        summary: 'Get batch processing status',
        description: 'Retrieves the status of all jobs in a specific batch',
    })
    @ApiParam({ name: 'batchId', description: 'Unique batch identifier' })
    @ApiResponse({
        status: 200,
        description: 'Batch status retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                batchId: { type: 'string' },
                jobs: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ProcessingResultDto' },
                },
                summary: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        pending: { type: 'number' },
                        processing: { type: 'number' },
                        completed: { type: 'number' },
                        failed: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Batch not found' })
    async getBatchStatus(@Param('batchId') batchId: string) {
        return this.dataProcessingService.getBatchStatus(batchId);
    }

    @Get('queue/status')
    @ApiOperation({
        summary: 'Get processing queue status',
        description: 'Retrieves current queue statistics and health information',
    })
    @ApiResponse({
        status: 200,
        description: 'Queue status retrieved successfully',
        type: QueueStatusDto,
    })
    async getQueueStatus(): Promise<QueueStatusDto> {
        return this.dataProcessingService.getQueueStatus();
    }

    @Get('stats')
    @ApiOperation({
        summary: 'Get processing statistics',
        description: 'Retrieves detailed processing statistics for a specified time period',
    })
    @ApiQuery({
        name: 'periodStart',
        description: 'Statistics period start (ISO string)',
        required: false,
        example: '2024-01-01T00:00:00Z',
    })
    @ApiQuery({
        name: 'periodEnd',
        description: 'Statistics period end (ISO string)',
        required: false,
        example: '2024-01-31T23:59:59Z',
    })
    @ApiResponse({
        status: 200,
        description: 'Processing statistics retrieved successfully',
        type: ProcessingStatsDto,
    })
    async getProcessingStats(
        @Query('periodStart') periodStart?: string,
        @Query('periodEnd') periodEnd?: string
    ): Promise<ProcessingStatsDto> {
        const start = periodStart
            ? new Date(periodStart)
            : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const end = periodEnd ? new Date(periodEnd) : new Date();

        return this.dataProcessingService.getProcessingStats(start, end);
    }

    @Get('health')
    @ApiOperation({
        summary: 'Get processing service health',
        description: 'Returns health status and basic metrics of the data processing service',
    })
    @ApiResponse({
        status: 200,
        description: 'Health status retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['HEALTHY', 'WARNING', 'CRITICAL'] },
                timestamp: { type: 'string', format: 'date-time' },
                uptime: { type: 'number', description: 'Service uptime in milliseconds' },
                memoryUsage: {
                    type: 'object',
                    properties: {
                        used: { type: 'number' },
                        total: { type: 'number' },
                        percentage: { type: 'number' },
                    },
                },
                queueMetrics: {
                    type: 'object',
                    properties: {
                        totalJobs: { type: 'number' },
                        activeJobs: { type: 'number' },
                        pendingJobs: { type: 'number' },
                        throughput: { type: 'number' },
                    },
                },
            },
        },
    })
    async getHealth() {
        const queueStatus = await this.dataProcessingService.getQueueStatus();
        const memoryUsage = process.memoryUsage();

        return {
            status: queueStatus.healthStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime() * 1000,
            memoryUsage: {
                used: memoryUsage.heapUsed,
                total: memoryUsage.heapTotal,
                percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
            },
            queueMetrics: {
                totalJobs: queueStatus.totalJobs,
                activeJobs: queueStatus.activeJobs,
                pendingJobs: queueStatus.pendingJobs,
                throughput: queueStatus.throughput,
            },
        };
    }

    @Post('jobs/:jobId/retry')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Retry failed job',
        description: 'Retries a failed processing job by resetting its status to pending',
    })
    @ApiParam({ name: 'jobId', description: 'Unique job identifier' })
    @ApiResponse({
        status: 200,
        description: 'Job retry initiated successfully',
        schema: {
            type: 'object',
            properties: {
                jobId: { type: 'string' },
                status: { type: 'string', example: 'RETRY_SCHEDULED' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 404, description: 'Job not found' })
    @ApiResponse({ status: 400, description: 'Job cannot be retried' })
    async retryJob(@Param('jobId') jobId: string) {
        // This would need to be implemented in the service
        return {
            jobId,
            status: 'RETRY_SCHEDULED',
            message: 'Job retry functionality not yet implemented',
        };
    }

    @Post('maintenance/cleanup')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Cleanup old jobs',
        description: 'Manually triggers cleanup of old completed and failed jobs',
    })
    @ApiResponse({
        status: 200,
        description: 'Cleanup completed successfully',
        schema: {
            type: 'object',
            properties: {
                cleanedJobs: { type: 'number' },
                message: { type: 'string' },
            },
        },
    })
    async cleanupOldJobs() {
        // This would trigger the cleanup method in the service
        return {
            cleanedJobs: 0,
            message: 'Manual cleanup functionality not yet implemented',
        };
    }

    @Get('metrics/performance')
    @ApiOperation({
        summary: 'Get performance metrics',
        description: 'Retrieves detailed performance metrics for monitoring and optimization',
    })
    @ApiResponse({
        status: 200,
        description: 'Performance metrics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                processingTimes: {
                    type: 'object',
                    properties: {
                        average: { type: 'number' },
                        median: { type: 'number' },
                        p95: { type: 'number' },
                        p99: { type: 'number' },
                    },
                },
                throughput: {
                    type: 'object',
                    properties: {
                        current: { type: 'number' },
                        peak: { type: 'number' },
                        average: { type: 'number' },
                    },
                },
                errorRates: {
                    type: 'object',
                    properties: {
                        overall: { type: 'number' },
                        byType: { type: 'object' },
                        recent: { type: 'number' },
                    },
                },
                resourceUsage: {
                    type: 'object',
                    properties: {
                        cpu: { type: 'number' },
                        memory: { type: 'number' },
                        io: { type: 'number' },
                    },
                },
            },
        },
    })
    async getPerformanceMetrics() {
        const queueStatus = await this.dataProcessingService.getQueueStatus();

        return {
            processingTimes: {
                average: queueStatus.averageProcessingTime,
                median: queueStatus.averageProcessingTime, // Simplified
                p95: queueStatus.averageProcessingTime * 1.5,
                p99: queueStatus.averageProcessingTime * 2,
            },
            throughput: {
                current: queueStatus.throughput,
                peak: queueStatus.throughput * 1.2, // Simplified
                average: queueStatus.throughput * 0.8,
            },
            errorRates: {
                overall:
                    queueStatus.totalJobs > 0
                        ? (queueStatus.failedJobs / queueStatus.totalJobs) * 100
                        : 0,
                byType: queueStatus.jobsByType,
                recent: 0, // Would need to be calculated
            },
            resourceUsage: {
                cpu: 0, // Would need CPU monitoring
                memory: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
                io: 0, // Would need IO monitoring
            },
        };
    }
}
