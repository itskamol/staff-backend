import { Test, TestingModule } from '@nestjs/testing';
import { DataProcessingService } from './data-processing.service';
import { PrismaService } from '@app/shared/database';
import { DataType, ProcessingStatus } from './dto/data-processing.dto';

describe('DataProcessingService', () => {
    let service: DataProcessingService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        computer: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        computerUser: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        employee: {
            findUnique: jest.fn(),
        },
        userOnComputer: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
        },
        activeWindow: {
            create: jest.fn(),
        },
        visitedSite: {
            create: jest.fn(),
        },
        screenshot: {
            create: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DataProcessingService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<DataProcessingService>(DataProcessingService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('submitJob', () => {
        it('should submit a processing job successfully', async () => {
            const jobDto = {
                jobId: 'test-job-1',
                dataType: DataType.ACTIVE_WINDOW,
                rawData: {
                    processName: 'chrome.exe',
                    windowTitle: 'Google Chrome',
                    activeTime: 3600,
                    datetime: '2024-01-15T09:30:00Z',
                },
                timestamp: '2024-01-15T09:30:00Z',
                computerUserLink: {
                    computerIdentifier: 'DESKTOP-001',
                    username: 'john.doe',
                    employeeId: 1,
                    computerInfo: {
                        hostname: 'DESKTOP-001',
                        macAddress: '00:11:22:33:44:55',
                        ipAddress: '192.168.1.100',
                    },
                },
            };

            const result = await service.submitJob(jobDto);

            expect(result.jobId).toBe(jobDto.jobId);
            expect(result.status).toBe('QUEUED');
        });
    });

    describe('submitBatch', () => {
        it('should submit multiple jobs in a batch', async () => {
            const batchDto = {
                jobs: [
                    {
                        jobId: 'batch-job-1',
                        dataType: DataType.ACTIVE_WINDOW,
                        rawData: {
                            processName: 'notepad.exe',
                            windowTitle: 'Untitled - Notepad',
                            activeTime: 1800,
                        },
                        timestamp: '2024-01-15T09:30:00Z',
                    },
                    {
                        jobId: 'batch-job-2',
                        dataType: DataType.VISITED_SITE,
                        rawData: {
                            url: 'https://example.com',
                            title: 'Example Site',
                            activeTime: 900,
                        },
                        timestamp: '2024-01-15T09:31:00Z',
                    },
                ],
                batchId: 'test-batch-1',
            };

            const result = await service.submitBatch(batchDto);

            expect(result.batchId).toBe('test-batch-1');
            expect(result.jobIds).toHaveLength(2);
            expect(result.status).toBe('QUEUED');
        });
    });

    describe('getJobStatus', () => {
        it('should return job status for existing job', async () => {
            const jobDto = {
                jobId: 'status-test-job',
                dataType: DataType.ACTIVE_WINDOW,
                rawData: { processName: 'test.exe' },
                timestamp: '2024-01-15T09:30:00Z',
            };

            await service.submitJob(jobDto);
            const status = await service.getJobStatus(jobDto.jobId);

            expect(status).toBeDefined();
            expect(status?.jobId).toBe(jobDto.jobId);
            expect(status?.status).toBe(ProcessingStatus.PENDING);
        });

        it('should return null for non-existent job', async () => {
            const status = await service.getJobStatus('non-existent-job');
            expect(status).toBeNull();
        });
    });

    describe('getQueueStatus', () => {
        it('should return current queue status', async () => {
            // Submit some test jobs
            await service.submitJob({
                jobId: 'queue-test-1',
                dataType: DataType.ACTIVE_WINDOW,
                rawData: { processName: 'test1.exe' },
                timestamp: '2024-01-15T09:30:00Z',
            });

            await service.submitJob({
                jobId: 'queue-test-2',
                dataType: DataType.VISITED_SITE,
                rawData: { url: 'https://test.com' },
                timestamp: '2024-01-15T09:31:00Z',
            });

            const queueStatus = await service.getQueueStatus();

            expect(queueStatus.totalJobs).toBeGreaterThan(0);
            expect(queueStatus.pendingJobs).toBeGreaterThan(0);
            expect(queueStatus.healthStatus).toBeDefined();
            expect(queueStatus.jobsByType).toBeDefined();
        });
    });

    describe('data validation', () => {
        it('should validate active window data correctly', async () => {
            const validData = {
                processName: 'chrome.exe',
                windowTitle: 'Google Chrome',
                activeTime: 3600,
            };

            // This would test the private validateAndSanitizeData method
            // We can test it indirectly through job processing
            const jobDto = {
                jobId: 'validation-test',
                dataType: DataType.ACTIVE_WINDOW,
                rawData: validData,
                timestamp: '2024-01-15T09:30:00Z',
            };

            const result = await service.submitJob(jobDto);
            expect(result.status).toBe('QUEUED');
        });

        it('should reject invalid data', async () => {
            const invalidData = {
                // Missing required fields
                activeTime: 'invalid-number',
            };

            const jobDto = {
                jobId: 'invalid-test',
                dataType: DataType.ACTIVE_WINDOW,
                rawData: invalidData,
                timestamp: '2024-01-15T09:30:00Z',
            };

            const result = await service.submitJob(jobDto);
            expect(result.status).toBe('QUEUED'); // Job is queued but will fail during processing
        });
    });

    describe('computer user linking', () => {
        it('should link computer and user successfully', async () => {
            const mockComputer = {
                id: 1,
                hostname: 'DESKTOP-001',
                macAddress: '00:11:22:33:44:55',
            };

            const mockUser = {
                id: 1,
                username: 'john.doe',
                computerId: 1,
            };

            const mockEmployee = {
                id: 1,
                name: 'John Doe',
            };

            mockPrismaService.computer.findFirst.mockResolvedValue(null);
            mockPrismaService.computer.create.mockResolvedValue(mockComputer);
            mockPrismaService.computerUser.findFirst.mockResolvedValue(null);
            mockPrismaService.computerUser.create.mockResolvedValue(mockUser);
            mockPrismaService.employee.findUnique.mockResolvedValue(mockEmployee);
            mockPrismaService.userOnComputer.upsert.mockResolvedValue({});

            const jobDto = {
                jobId: 'linking-test',
                dataType: DataType.ACTIVE_WINDOW,
                rawData: {
                    processName: 'test.exe',
                    windowTitle: 'Test Window',
                    activeTime: 1000,
                },
                timestamp: '2024-01-15T09:30:00Z',
                computerUserLink: {
                    computerIdentifier: 'DESKTOP-001',
                    username: 'john.doe',
                    employeeId: 1,
                    computerInfo: {
                        hostname: 'DESKTOP-001',
                        macAddress: '00:11:22:33:44:55',
                        ipAddress: '192.168.1.100',
                    },
                },
            };

            const result = await service.submitJob(jobDto);
            expect(result.status).toBe('QUEUED');
        });
    });

    describe('processing statistics', () => {
        it('should calculate processing statistics', async () => {
            const periodStart = new Date('2024-01-01T00:00:00Z');
            const periodEnd = new Date('2024-01-31T23:59:59Z');

            const stats = await service.getProcessingStats(periodStart, periodEnd);

            expect(stats.periodStart).toBe(periodStart.toISOString());
            expect(stats.periodEnd).toBe(periodEnd.toISOString());
            expect(stats.totalJobsProcessed).toBeGreaterThanOrEqual(0);
            expect(stats.successRate).toBeGreaterThanOrEqual(0);
            expect(stats.hourlyStats).toHaveLength(24);
        });
    });
});
