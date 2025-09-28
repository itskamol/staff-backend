import {
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
    IsNumber,
    IsObject,
    IsArray,
    ValidateNested,
    IsBoolean,
    IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ProcessingStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    RETRY = 'RETRY',
}

export enum DataType {
    ACTIVE_WINDOW = 'ACTIVE_WINDOW',
    VISITED_SITE = 'VISITED_SITE',
    SCREENSHOT = 'SCREENSHOT',
    USER_SESSION = 'USER_SESSION',
    HIKVISION_ACTION = 'HIKVISION_ACTION',
    HIKVISION_EVENT = 'HIKVISION_EVENT',
}

export class ComputerUserLinkDto {
    @ApiProperty({ description: 'Computer identifier (hostname, MAC address, etc.)' })
    @IsString()
    computerIdentifier: string;

    @ApiProperty({ description: 'Username on the computer' })
    @IsString()
    username: string;

    @ApiPropertyOptional({ description: 'Employee ID if known' })
    @IsOptional()
    @IsNumber()
    employeeId?: number;

    @ApiPropertyOptional({ description: 'Additional computer info' })
    @IsOptional()
    @IsObject()
    computerInfo?: {
        hostname?: string;
        macAddress?: string;
        ipAddress?: string;
        operatingSystem?: string;
        domain?: string;
    };
}

export class DataValidationResult {
    @ApiProperty({ description: 'Whether data is valid' })
    @IsBoolean()
    isValid: boolean;

    @ApiPropertyOptional({ description: 'Validation errors if any' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    errors?: string[];

    @ApiPropertyOptional({ description: 'Sanitized data' })
    @IsOptional()
    @IsObject()
    sanitizedData?: any;

    @ApiPropertyOptional({ description: 'Data quality score (0-100)' })
    @IsOptional()
    @IsNumber()
    qualityScore?: number;
}

export class ProcessingJobDto {
    @ApiProperty({ description: 'Unique job identifier' })
    @IsUUID()
    jobId: string;

    @ApiProperty({
        description: 'Type of data being processed',
        enum: DataType,
        example: DataType.ACTIVE_WINDOW,
    })
    @IsEnum(DataType)
    dataType: DataType;

    @ApiProperty({ description: 'Raw data to be processed' })
    @IsObject()
    rawData: any;

    @ApiProperty({
        description: 'Processing timestamp',
        example: '2024-01-15T09:30:00Z',
    })
    @IsDateString()
    timestamp: string;

    @ApiPropertyOptional({ description: 'Priority level (1-10, higher is more priority)' })
    @IsOptional()
    @IsNumber()
    priority?: number;

    @ApiPropertyOptional({ description: 'Computer user linking information' })
    @IsOptional()
    @ValidateNested()
    @Type(() => ComputerUserLinkDto)
    computerUserLink?: ComputerUserLinkDto;

    @ApiPropertyOptional({ description: 'Additional processing options' })
    @IsOptional()
    @IsObject()
    options?: {
        skipValidation?: boolean;
        forceReprocess?: boolean;
        batchId?: string;
        retryCount?: number;
    };
}

export class BatchProcessingDto {
    @ApiProperty({
        description: 'Array of processing jobs',
        type: [ProcessingJobDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProcessingJobDto)
    jobs: ProcessingJobDto[];

    @ApiPropertyOptional({ description: 'Batch identifier' })
    @IsOptional()
    @IsString()
    batchId?: string;

    @ApiPropertyOptional({ description: 'Batch processing options' })
    @IsOptional()
    @IsObject()
    batchOptions?: {
        maxConcurrency?: number;
        failFast?: boolean;
        retryFailedJobs?: boolean;
    };
}

export class ProcessingResultDto {
    @ApiProperty({ description: 'Job identifier' })
    @IsString()
    jobId: string;

    @ApiProperty({
        description: 'Processing status',
        enum: ProcessingStatus,
        example: ProcessingStatus.COMPLETED,
    })
    @IsEnum(ProcessingStatus)
    status: ProcessingStatus;

    @ApiProperty({ description: 'Processing start time' })
    @IsDateString()
    startTime: string;

    @ApiPropertyOptional({ description: 'Processing end time' })
    @IsOptional()
    @IsDateString()
    endTime?: string;

    @ApiPropertyOptional({ description: 'Processing duration in milliseconds' })
    @IsOptional()
    @IsNumber()
    duration?: number;

    @ApiPropertyOptional({ description: 'Processed data' })
    @IsOptional()
    @IsObject()
    processedData?: any;

    @ApiPropertyOptional({ description: 'Validation result' })
    @IsOptional()
    @ValidateNested()
    @Type(() => DataValidationResult)
    validationResult?: DataValidationResult;

    @ApiPropertyOptional({ description: 'Computer user linking result' })
    @IsOptional()
    @IsObject()
    linkingResult?: {
        computerMatched: boolean;
        userMatched: boolean;
        employeeMatched: boolean;
        computerId?: number;
        userId?: number;
        employeeId?: number;
    };

    @ApiPropertyOptional({ description: 'Database records created/updated' })
    @IsOptional()
    @IsObject()
    databaseResult?: {
        recordsCreated: number;
        recordsUpdated: number;
        recordIds: number[];
    };

    @ApiPropertyOptional({ description: 'Error information if processing failed' })
    @IsOptional()
    @IsObject()
    error?: {
        message: string;
        code: string;
        details?: any;
        stack?: string;
    };

    @ApiPropertyOptional({ description: 'Processing metrics' })
    @IsOptional()
    @IsObject()
    metrics?: {
        dataSize: number;
        memoryUsed: number;
        cpuTime: number;
        ioOperations: number;
    };
}

export class QueueStatusDto {
    @ApiProperty({ description: 'Total jobs in queue' })
    @IsNumber()
    totalJobs: number;

    @ApiProperty({ description: 'Jobs currently being processed' })
    @IsNumber()
    activeJobs: number;

    @ApiProperty({ description: 'Jobs waiting to be processed' })
    @IsNumber()
    pendingJobs: number;

    @ApiProperty({ description: 'Successfully completed jobs' })
    @IsNumber()
    completedJobs: number;

    @ApiProperty({ description: 'Failed jobs' })
    @IsNumber()
    failedJobs: number;

    @ApiProperty({ description: 'Average processing time in milliseconds' })
    @IsNumber()
    averageProcessingTime: number;

    @ApiProperty({ description: 'Queue throughput (jobs per minute)' })
    @IsNumber()
    throughput: number;

    @ApiPropertyOptional({ description: 'Queue health status' })
    @IsOptional()
    @IsString()
    healthStatus?: 'HEALTHY' | 'WARNING' | 'CRITICAL';

    @ApiPropertyOptional({ description: 'Recent job statistics by data type' })
    @IsOptional()
    @IsObject()
    jobsByType?: Record<
        DataType,
        {
            total: number;
            completed: number;
            failed: number;
            averageTime: number;
        }
    >;
}

export class ProcessingStatsDto {
    @ApiProperty({ description: 'Statistics period start' })
    @IsDateString()
    periodStart: string;

    @ApiProperty({ description: 'Statistics period end' })
    @IsDateString()
    periodEnd: string;

    @ApiProperty({ description: 'Total jobs processed in period' })
    @IsNumber()
    totalJobsProcessed: number;

    @ApiProperty({ description: 'Success rate percentage' })
    @IsNumber()
    successRate: number;

    @ApiProperty({ description: 'Average processing time' })
    @IsNumber()
    averageProcessingTime: number;

    @ApiProperty({ description: 'Peak processing time' })
    @IsNumber()
    peakProcessingTime: number;

    @ApiProperty({ description: 'Data volume processed (bytes)' })
    @IsNumber()
    dataVolumeProcessed: number;

    @ApiProperty({ description: 'Error breakdown by type' })
    @IsObject()
    errorBreakdown: Record<string, number>;

    @ApiProperty({ description: 'Processing performance by hour' })
    @IsArray()
    hourlyStats: Array<{
        hour: number;
        jobsProcessed: number;
        averageTime: number;
        errorRate: number;
    }>;
}
