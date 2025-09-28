import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import {
    ProcessingJobDto,
    BatchProcessingDto,
    ProcessingResultDto,
    DataValidationResult,
    ComputerUserLinkDto,
    QueueStatusDto,
    ProcessingStatsDto,
    ProcessingStatus,
    DataType,
} from './dto/data-processing.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

interface QueueJob {
    id: string;
    jobDto: ProcessingJobDto;
    status: ProcessingStatus;
    startTime?: Date;
    endTime?: Date;
    retryCount: number;
    result?: ProcessingResultDto;
    error?: {
        message: string;
        code: string;
        details?: any;
        stack?: string;
    };
}

@Injectable()
export class DataProcessingService implements OnModuleInit {
    private readonly logger = new Logger(DataProcessingService.name);
    private readonly processingQueue: Map<string, QueueJob> = new Map();
    private readonly activeJobs: Set<string> = new Set();
    private readonly maxConcurrentJobs = 10;
    private readonly maxRetries = 3;
    private processingStats = {
        totalProcessed: 0,
        totalFailed: 0,
        totalTime: 0,
        startTime: new Date(),
    };

    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        this.logger.log('Data Processing Service initialized');
        this.startProcessingLoop();
    }

    async submitJob(jobDto: ProcessingJobDto): Promise<{ jobId: string; status: string }> {
        const job: QueueJob = {
            id: jobDto.jobId,
            jobDto,
            status: ProcessingStatus.PENDING,
            retryCount: 0,
        };

        this.processingQueue.set(job.id, job);
        this.logger.debug(`Job submitted: ${job.id} (type: ${jobDto.dataType})`);

        return {
            jobId: job.id,
            status: 'QUEUED',
        };
    }

    async submitBatch(
        batchDto: BatchProcessingDto
    ): Promise<{ batchId: string; jobIds: string[]; status: string }> {
        const batchId =
            batchDto.batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const jobIds: string[] = [];

        for (const jobDto of batchDto.jobs) {
            // Add batch ID to job options
            jobDto.options = {
                ...jobDto.options,
                batchId,
            };

            const result = await this.submitJob(jobDto);
            jobIds.push(result.jobId);
        }

        this.logger.log(`Batch submitted: ${batchId} with ${jobIds.length} jobs`);

        return {
            batchId,
            jobIds,
            status: 'QUEUED',
        };
    }

    async getJobStatus(jobId: string): Promise<ProcessingResultDto | null> {
        const job = this.processingQueue.get(jobId);
        if (!job) return null;

        return this.buildProcessingResult(job);
    }

    async getBatchStatus(
        batchId: string
    ): Promise<{ batchId: string; jobs: ProcessingResultDto[]; summary: any }> {
        const batchJobs: QueueJob[] = [];

        for (const job of this.processingQueue.values()) {
            if (job.jobDto.options?.batchId === batchId) {
                batchJobs.push(job);
            }
        }

        const jobs = batchJobs.map(job => this.buildProcessingResult(job));
        const summary = {
            total: batchJobs.length,
            pending: batchJobs.filter(j => j.status === ProcessingStatus.PENDING).length,
            processing: batchJobs.filter(j => j.status === ProcessingStatus.PROCESSING).length,
            completed: batchJobs.filter(j => j.status === ProcessingStatus.COMPLETED).length,
            failed: batchJobs.filter(j => j.status === ProcessingStatus.FAILED).length,
        };

        return { batchId, jobs, summary };
    }

    async getQueueStatus(): Promise<QueueStatusDto> {
        const jobs = Array.from(this.processingQueue.values());
        const completedJobs = jobs.filter(j => j.status === ProcessingStatus.COMPLETED);
        const totalProcessingTime = completedJobs.reduce((sum, job) => {
            if (job.startTime && job.endTime) {
                return sum + (job.endTime.getTime() - job.startTime.getTime());
            }
            return sum;
        }, 0);

        const jobsByType: Record<DataType, any> = {} as any;
        for (const dataType of Object.values(DataType)) {
            const typeJobs = jobs.filter(j => j.jobDto.dataType === dataType);
            const typeCompleted = typeJobs.filter(j => j.status === ProcessingStatus.COMPLETED);
            const typeAvgTime =
                typeCompleted.length > 0
                    ? typeCompleted.reduce((sum, job) => {
                          if (job.startTime && job.endTime) {
                              return sum + (job.endTime.getTime() - job.startTime.getTime());
                          }
                          return sum;
                      }, 0) / typeCompleted.length
                    : 0;

            jobsByType[dataType] = {
                total: typeJobs.length,
                completed: typeCompleted.length,
                failed: typeJobs.filter(j => j.status === ProcessingStatus.FAILED).length,
                averageTime: typeAvgTime,
            };
        }

        return {
            totalJobs: jobs.length,
            activeJobs: this.activeJobs.size,
            pendingJobs: jobs.filter(j => j.status === ProcessingStatus.PENDING).length,
            completedJobs: jobs.filter(j => j.status === ProcessingStatus.COMPLETED).length,
            failedJobs: jobs.filter(j => j.status === ProcessingStatus.FAILED).length,
            averageProcessingTime:
                completedJobs.length > 0 ? totalProcessingTime / completedJobs.length : 0,
            throughput: this.calculateThroughput(),
            healthStatus: this.getHealthStatus(),
            jobsByType,
        };
    }

    async getProcessingStats(periodStart: Date, periodEnd: Date): Promise<ProcessingStatsDto> {
        const jobs = Array.from(this.processingQueue.values()).filter(job => {
            return job.startTime && job.startTime >= periodStart && job.startTime <= periodEnd;
        });

        const completedJobs = jobs.filter(j => j.status === ProcessingStatus.COMPLETED);
        const failedJobs = jobs.filter(j => j.status === ProcessingStatus.FAILED);

        const totalProcessingTime = completedJobs.reduce((sum, job) => {
            if (job.startTime && job.endTime) {
                return sum + (job.endTime.getTime() - job.startTime.getTime());
            }
            return sum;
        }, 0);

        const errorBreakdown: Record<string, number> = {};
        failedJobs.forEach(job => {
            const errorType = job.error?.code || 'UNKNOWN_ERROR';
            errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
        });

        const hourlyStats = this.calculateHourlyStats(jobs, periodStart, periodEnd);

        return {
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            totalJobsProcessed: jobs.length,
            successRate: jobs.length > 0 ? (completedJobs.length / jobs.length) * 100 : 0,
            averageProcessingTime:
                completedJobs.length > 0 ? totalProcessingTime / completedJobs.length : 0,
            peakProcessingTime: Math.max(
                ...completedJobs.map(job => {
                    if (job.startTime && job.endTime) {
                        return job.endTime.getTime() - job.startTime.getTime();
                    }
                    return 0;
                })
            ),
            dataVolumeProcessed: jobs.reduce(
                (sum, job) => sum + JSON.stringify(job.jobDto.rawData).length,
                0
            ),
            errorBreakdown,
            hourlyStats,
        };
    }

    private async startProcessingLoop() {
        setInterval(async () => {
            await this.processNextJobs();
        }, 1000); // Check every second
    }

    private async processNextJobs() {
        const availableSlots = this.maxConcurrentJobs - this.activeJobs.size;
        if (availableSlots <= 0) return;

        const pendingJobs = Array.from(this.processingQueue.values())
            .filter(job => job.status === ProcessingStatus.PENDING)
            .sort((a, b) => (b.jobDto.priority || 0) - (a.jobDto.priority || 0))
            .slice(0, availableSlots);

        for (const job of pendingJobs) {
            this.processJob(job);
        }
    }

    private async processJob(job: QueueJob) {
        this.activeJobs.add(job.id);
        job.status = ProcessingStatus.PROCESSING;
        job.startTime = new Date();

        this.logger.debug(`Processing job: ${job.id} (type: ${job.jobDto.dataType})`);

        try {
            const result = await this.executeJobProcessing(job.jobDto);

            job.status = ProcessingStatus.COMPLETED;
            job.endTime = new Date();
            job.result = result;

            this.processingStats.totalProcessed++;
            this.processingStats.totalTime += job.endTime.getTime() - job.startTime.getTime();

            this.logger.debug(`Job completed: ${job.id}`);
        } catch (error) {
            this.logger.error(`Job failed: ${job.id}`, error.stack);

            job.retryCount++;
            job.error = {
                message: error.message,
                code: error.code || 'PROCESSING_ERROR',
                details: error.details,
                stack: error.stack,
            };

            if (job.retryCount < this.maxRetries) {
                job.status = ProcessingStatus.RETRY;
                // Add delay before retry
                setTimeout(() => {
                    job.status = ProcessingStatus.PENDING;
                }, Math.pow(2, job.retryCount) * 1000); // Exponential backoff
            } else {
                job.status = ProcessingStatus.FAILED;
                job.endTime = new Date();
                this.processingStats.totalFailed++;
            }
        } finally {
            this.activeJobs.delete(job.id);
        }
    }

    private async executeJobProcessing(jobDto: ProcessingJobDto): Promise<ProcessingResultDto> {
        const startTime = new Date();

        // Step 1: Validate and sanitize data
        const validationResult = await this.validateAndSanitizeData(
            jobDto.rawData,
            jobDto.dataType
        );

        if (!validationResult.isValid && !jobDto.options?.skipValidation) {
            throw new Error(`Data validation failed: ${validationResult.errors?.join(', ')}`);
        }

        // Step 2: Link computer and user if needed
        let linkingResult;
        if (jobDto.computerUserLink) {
            linkingResult = await this.linkComputerAndUser(jobDto.computerUserLink);
        }

        // Step 3: Process data based on type
        let processedData;
        let databaseResult;

        switch (jobDto.dataType) {
            case DataType.ACTIVE_WINDOW:
                ({ processedData, databaseResult } = await this.processActiveWindowData(
                    validationResult.sanitizedData,
                    linkingResult
                ));
                break;
            case DataType.VISITED_SITE:
                ({ processedData, databaseResult } = await this.processVisitedSiteData(
                    validationResult.sanitizedData,
                    linkingResult
                ));
                break;
            case DataType.SCREENSHOT:
                ({ processedData, databaseResult } = await this.processScreenshotData(
                    validationResult.sanitizedData,
                    linkingResult
                ));
                break;
            case DataType.USER_SESSION:
                ({ processedData, databaseResult } = await this.processUserSessionData(
                    validationResult.sanitizedData,
                    linkingResult
                ));
                break;
            default:
                throw new Error(`Unsupported data type: ${jobDto.dataType}`);
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        return {
            jobId: jobDto.jobId,
            status: ProcessingStatus.COMPLETED,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration,
            processedData,
            validationResult,
            linkingResult,
            databaseResult,
            metrics: {
                dataSize: JSON.stringify(jobDto.rawData).length,
                memoryUsed: process.memoryUsage().heapUsed,
                cpuTime: duration,
                ioOperations:
                    databaseResult?.recordsCreated || 0 + databaseResult?.recordsUpdated || 0,
            },
        };
    }

    private async validateAndSanitizeData(
        rawData: any,
        dataType: DataType
    ): Promise<DataValidationResult> {
        const errors: string[] = [];
        let qualityScore = 100;

        // Basic validation
        if (!rawData || typeof rawData !== 'object') {
            errors.push('Raw data must be a valid object');
            return { isValid: false, errors, qualityScore: 0 };
        }

        // Type-specific validation
        switch (dataType) {
            case DataType.ACTIVE_WINDOW:
                if (!rawData.processName) errors.push('processName is required');
                if (!rawData.windowTitle) errors.push('windowTitle is required');
                if (typeof rawData.activeTime !== 'number')
                    errors.push('activeTime must be a number');
                break;

            case DataType.VISITED_SITE:
                if (!rawData.url) errors.push('url is required');
                if (typeof rawData.activeTime !== 'number')
                    errors.push('activeTime must be a number');
                break;

            case DataType.SCREENSHOT:
                if (!rawData.imageData) errors.push('imageData is required');
                if (!rawData.timestamp) errors.push('timestamp is required');
                break;

            case DataType.USER_SESSION:
                if (!rawData.sessionStart) errors.push('sessionStart is required');
                if (!rawData.username) errors.push('username is required');
                break;
        }

        // Calculate quality score
        if (errors.length > 0) {
            qualityScore = Math.max(0, 100 - errors.length * 20);
        }

        // Sanitize data
        const sanitizedData = this.sanitizeData(rawData);

        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            sanitizedData,
            qualityScore,
        };
    }

    private sanitizeData(data: any): any {
        // Remove potentially harmful content
        const sanitized = JSON.parse(JSON.stringify(data));

        // Remove script tags, SQL injection attempts, etc.
        if (typeof sanitized === 'object') {
            for (const key in sanitized) {
                if (typeof sanitized[key] === 'string') {
                    sanitized[key] = sanitized[key]
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/['"`;]/g, '');
                }
            }
        }

        return sanitized;
    }

    private async linkComputerAndUser(linkDto: ComputerUserLinkDto) {
        let computerId: number | null = null;
        let userId: number | null = null;
        let employeeId: number | null = null;

        // Find or create computer
        let computer = await this.prisma.computer.findFirst({
            where: {
                OR: [
                    {
                        computerUid: linkDto.computerInfo?.hostname || linkDto.computerIdentifier,
                    },
                    { macAddress: linkDto.computerInfo?.macAddress },
                    { ipAddress: linkDto.computerInfo?.ipAddress },
                ],
            },
        });

        if (!computer && linkDto.computerInfo) {
            computer = await this.prisma.computer.create({
                data: {
                    computerUid: linkDto.computerInfo.hostname || linkDto.computerIdentifier,
                    macAddress: linkDto.computerInfo.macAddress,
                    ipAddress: linkDto.computerInfo.ipAddress,
                    os: linkDto.computerInfo.operatingSystem,
                },
            });
        }

        if (computer) {
            computerId = computer.id;
        }

        // Find or create user
        let user = await this.prisma.computerUser.findFirst({
            where: {
                username: linkDto.username,
                sid: linkDto.computerIdentifier || linkDto.username,
            },
        });

        // if (!user) {
        //   // Need to create with employeeId - find or create a default employee
        //   const defaultEmployee = await this.findOrCreateDefaultEmployee();
        //   user = await this.prisma.computerUser.create({
        //     data: {
        //       username: linkDto.username,
        //       sid: linkDto.username, // Use username as SID fallback
        //       name: linkDto.username,
        //       employeeId: defaultEmployee.id,
        //     },
        //   });
        // }

        if (user) {
            userId = user.id;
        }

        // Link to employee if provided
        if (linkDto.employeeId) {
            const employee = await this.prisma.employee.findUnique({
                where: { id: linkDto.employeeId },
            });

            if (employee) {
                employeeId = employee.id;

                // Create or update user-computer link
                if (userId && computerId) {
                    await this.prisma.usersOnComputers.upsert({
                        where: {
                            computerId,
                            id: userId,
                        },
                        update: {
                            // Update any fields if needed
                        },
                        create: {
                            computerUserId: userId,
                            computerId,
                        },
                    });
                }
            }
        }

        return {
            computerMatched: computerId !== null,
            userMatched: userId !== null,
            employeeMatched: employeeId !== null,
            computerId,
            userId,
            employeeId,
        };
    }

    private async processActiveWindowData(data: any, linkingResult?: any) {
        const userOnComputerId =
            linkingResult?.userId && linkingResult?.computerId
                ? await this.getUserOnComputerId(linkingResult.userId, linkingResult.computerId)
                : null;

        const activeWindow = await this.prisma.activeWindow.create({
            data: {
                usersOnComputersId: userOnComputerId,
                processName: data.processName,
                title: data.windowTitle,
                activeTime: data.activeTime,
                datetime: new Date(data.datetime || Date.now()),
            },
        });

        return {
            processedData: {
                activeWindowId: activeWindow.id,
                processName: data.processName,
                windowTitle: data.windowTitle,
                activeTime: data.activeTime,
            },
            databaseResult: {
                recordsCreated: 1,
                recordsUpdated: 0,
                recordIds: [activeWindow.id],
            },
        };
    }

    private async processVisitedSiteData(data: any, linkingResult?: any) {
        const userOnComputerId =
            linkingResult?.userId && linkingResult?.computerId
                ? await this.getUserOnComputerId(linkingResult.userId, linkingResult.computerId)
                : null;

        const visitedSite = await this.prisma.visitedSite.create({
            data: {
                usersOnComputersId: userOnComputerId,
                url: data.url,
                title: data.title || '',
                processName: data.processName || 'Unknown',
                icon: data.icon || null,
                activeTime: data.activeTime || 0,
                datetime: new Date(data.datetime || Date.now()),
            },
        });

        return {
            processedData: {
                visitedSiteId: visitedSite.id,
                url: data.url,
                title: data.title,
                activeTime: data.activeTime,
            },
            databaseResult: {
                recordsCreated: 1,
                recordsUpdated: 0,
                recordIds: [visitedSite.id],
            },
        };
    }

    private async processScreenshotData(data: any, linkingResult?: any) {
        const userOnComputerId =
            linkingResult?.userId && linkingResult?.computerId
                ? await this.getUserOnComputerId(linkingResult.userId, linkingResult.computerId)
                : null;

        const screenshot = await this.prisma.screenshot.create({
            data: {
                usersOnComputersId: userOnComputerId,
                filePath: data.imageData,
                title: data.title || null,
                processName: data.processName || 'Unknown',
                icon: data.icon || null,
                datetime: new Date(data.datetime || Date.now()),
            },
        });

        return {
            processedData: {
                screenshotId: screenshot.id,
                timestamp: data.datetime,
                imageSize: data.imageData.length,
            },
            databaseResult: {
                recordsCreated: 1,
                recordsUpdated: 0,
                recordIds: [screenshot.id],
            },
        };
    }

    private async processUserSessionData(data: any, linkingResult?: any) {
        // Process user session data - login/logout events
        const sessionData = {
            username: data.username,
            sessionStart: new Date(data.sessionStart),
            sessionEnd: data.sessionEnd ? new Date(data.sessionEnd) : null,
            computerId: linkingResult?.computerId,
            employeeId: linkingResult?.employeeId,
        };

        return {
            processedData: sessionData,
            databaseResult: {
                recordsCreated: 0,
                recordsUpdated: 0,
                recordIds: [],
            },
        };
    }

    private async getUserOnComputerId(userId: number, computerId: number): Promise<number | null> {
        const userOnComputer = await this.prisma.usersOnComputers.findFirst({
            where: {
                computerUser: {
                    employeeId: userId,
                },
                computerId: computerId,
            },
        });

        return userOnComputer?.id || null;
    }

    private buildProcessingResult(job: QueueJob): ProcessingResultDto {
        return {
            jobId: job.id,
            status: job.status,
            startTime: job.startTime?.toISOString() || new Date().toISOString(),
            endTime: job.endTime?.toISOString(),
            duration:
                job.startTime && job.endTime
                    ? job.endTime.getTime() - job.startTime.getTime()
                    : undefined,
            processedData: job.result?.processedData,
            validationResult: job.result?.validationResult,
            linkingResult: job.result?.linkingResult,
            databaseResult: job.result?.databaseResult,
            error: job.error,
            metrics: job.result?.metrics,
        };
    }

    private calculateThroughput(): number {
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);

        const recentJobs = Array.from(this.processingQueue.values()).filter(
            job => job.endTime && job.endTime >= oneMinuteAgo
        );

        return recentJobs.length;
    }

    private getHealthStatus(): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
        const queueSize = this.processingQueue.size;
        const activeJobs = this.activeJobs.size;
        const failureRate =
            this.processingStats.totalFailed /
            (this.processingStats.totalProcessed + this.processingStats.totalFailed);

        if (queueSize > 1000 || activeJobs === this.maxConcurrentJobs || failureRate > 0.1) {
            return 'CRITICAL';
        } else if (queueSize > 500 || failureRate > 0.05) {
            return 'WARNING';
        }

        return 'HEALTHY';
    }

    private calculateHourlyStats(jobs: QueueJob[], periodStart: Date, periodEnd: Date) {
        const hourlyStats = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            jobsProcessed: 0,
            averageTime: 0,
            errorRate: 0,
        }));

        jobs.forEach(job => {
            if (job.startTime) {
                const hour = job.startTime.getHours();
                hourlyStats[hour].jobsProcessed++;

                if (job.startTime && job.endTime) {
                    const processingTime = job.endTime.getTime() - job.startTime.getTime();
                    hourlyStats[hour].averageTime =
                        (hourlyStats[hour].averageTime * (hourlyStats[hour].jobsProcessed - 1) +
                            processingTime) /
                        hourlyStats[hour].jobsProcessed;
                }

                if (job.status === ProcessingStatus.FAILED) {
                    hourlyStats[hour].errorRate =
                        (hourlyStats[hour].errorRate * (hourlyStats[hour].jobsProcessed - 1) + 1) /
                        hourlyStats[hour].jobsProcessed;
                }
            }
        });

        return hourlyStats;
    }

    @Cron(CronExpression.EVERY_HOUR)
    private async cleanupOldJobs() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        let cleanedCount = 0;

        for (const [jobId, job] of this.processingQueue.entries()) {
            if (
                job.endTime &&
                job.endTime < cutoffTime &&
                (job.status === ProcessingStatus.COMPLETED ||
                    job.status === ProcessingStatus.FAILED)
            ) {
                this.processingQueue.delete(jobId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.log(`Cleaned up ${cleanedCount} old jobs`);
        }
    }
}
