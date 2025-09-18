import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { LoggerService } from '../logger';

describe('QueueService', () => {
    let service: QueueService;
    let mockEventsQueue: any;
    let mockNotificationsQueue: any;
    let mockExportsQueue: any;
    let mockSystemHealthQueue: any;
    let loggerService: jest.Mocked<LoggerService>;

    beforeEach(async () => {
        const mockQueue = {
            add: jest.fn(),
            getWaiting: jest.fn(),
            getActive: jest.fn(),
            getCompleted: jest.fn(),
            getFailed: jest.fn(),
            getDelayed: jest.fn(),
            clean: jest.fn(),
        };

        mockEventsQueue = { ...mockQueue };
        mockNotificationsQueue = { ...mockQueue };
        mockExportsQueue = { ...mockQueue };
        mockSystemHealthQueue = { ...mockQueue };

        const mockLoggerService = {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QueueService,
                {
                    provide: getQueueToken('events'),
                    useValue: mockEventsQueue,
                },
                {
                    provide: getQueueToken('notifications'),
                    useValue: mockNotificationsQueue,
                },
                {
                    provide: getQueueToken('exports'),
                    useValue: mockExportsQueue,
                },
                {
                    provide: getQueueToken('system-health'),
                    useValue: mockSystemHealthQueue,
                },
                {
                    provide: LoggerService,
                    useValue: mockLoggerService,
                },
            ],
        }).compile();

        service = module.get<QueueService>(QueueService);
        loggerService = module.get(LoggerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('addEventJob', () => {
        it('should add job to events queue successfully', async () => {
            const mockJob = { id: 'job-123' };
            const jobData = { organizationId: 'org-123', eventType: 'test' };

            mockEventsQueue.add.mockResolvedValue(mockJob);

            const result = await service.addEventJob('test-event', jobData);

            expect(mockEventsQueue.add).toHaveBeenCalledWith('test-event', jobData, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
            });
            expect(loggerService.log).toHaveBeenCalledWith(
                'Event job added: test-event',
                expect.objectContaining({
                    jobId: 'job-123',
                    queueName: 'events',
                })
            );
            expect(result).toBe(mockJob);
        });

        it('should handle job addition failure', async () => {
            const error = new Error('Queue error');
            const jobData = { organizationId: 'org-123' };

            mockEventsQueue.add.mockRejectedValue(error);

            await expect(service.addEventJob('test-event', jobData)).rejects.toThrow('Queue error');

            expect(loggerService.error).toHaveBeenCalledWith(
                'Failed to add event job: test-event',
                error,
                expect.any(Object)
            );
        });
    });

    describe('addNotificationJob', () => {
        it('should add job to notifications queue with correct retry settings', async () => {
            const mockJob = { id: 'job-456' };
            const jobData = { organizationId: 'org-123', type: 'email' };

            mockNotificationsQueue.add.mockResolvedValue(mockJob);

            const result = await service.addNotificationJob('send-email', jobData);

            expect(mockNotificationsQueue.add).toHaveBeenCalledWith('send-email', jobData, {
                attempts: 5,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            });
            expect(result).toBe(mockJob);
        });
    });

    describe('getQueueStats', () => {
        it('should return queue statistics', async () => {
            const mockJobs = {
                waiting: [1, 2],
                active: [3],
                completed: [4, 5, 6],
                failed: [7],
                delayed: [],
            };

            mockEventsQueue.getWaiting.mockResolvedValue(mockJobs.waiting);
            mockEventsQueue.getActive.mockResolvedValue(mockJobs.active);
            mockEventsQueue.getCompleted.mockResolvedValue(mockJobs.completed);
            mockEventsQueue.getFailed.mockResolvedValue(mockJobs.failed);
            mockEventsQueue.getDelayed.mockResolvedValue(mockJobs.delayed);

            const result = await service.getQueueStats('events');

            expect(result).toEqual({
                name: 'events',
                waiting: 2,
                active: 1,
                completed: 3,
                failed: 1,
                delayed: 0,
            });
        });

        it('should throw error for unknown queue', async () => {
            await expect(service.getQueueStats('unknown')).rejects.toThrow(
                'Unknown queue: unknown'
            );
        });
    });

    describe('getAllQueueStats', () => {
        it('should return statistics for all queues', async () => {
            const mockStats = {
                waiting: [],
                active: [],
                completed: [],
                failed: [],
                delayed: [],
            };

            // Mock all queue methods
            [
                mockEventsQueue,
                mockNotificationsQueue,
                mockExportsQueue,
                mockSystemHealthQueue,
            ].forEach(queue => {
                Object.keys(mockStats).forEach(method => {
                    queue[
                        `get${method.charAt(0).toUpperCase() + method.slice(1)}`
                    ].mockResolvedValue(mockStats[method]);
                });
            });

            const result = await service.getAllQueueStats();

            expect(result).toHaveLength(4);
            expect(result.map(stat => stat.name)).toEqual([
                'events',
                'notifications',
                'exports',
                'system-health',
            ]);
        });
    });

    describe('cleanQueue', () => {
        it('should clean completed jobs from queue', async () => {
            const cleanedJobs = ['job1', 'job2', 'job3'];
            mockEventsQueue.clean.mockResolvedValue(cleanedJobs);

            const result = await service.cleanQueue('events', 7200000);

            expect(mockEventsQueue.clean).toHaveBeenCalledWith(7200000, 100, 'completed');
            expect(loggerService.log).toHaveBeenCalledWith(
                'Cleaned 3 completed jobs from events queue'
            );
            expect(result).toBe(3);
        });
    });

    describe('retryFailedJobs', () => {
        it('should retry all failed jobs', async () => {
            const mockFailedJobs = [
                { id: 'job1', retry: jest.fn().mockResolvedValue(undefined) },
                { id: 'job2', retry: jest.fn().mockResolvedValue(undefined) },
            ];

            mockEventsQueue.getFailed.mockResolvedValue(mockFailedJobs);

            const result = await service.retryFailedJobs('events');

            expect(mockFailedJobs[0].retry).toHaveBeenCalled();
            expect(mockFailedJobs[1].retry).toHaveBeenCalled();
            expect(loggerService.log).toHaveBeenCalledWith(
                'Retried 2 failed jobs from events queue'
            );
            expect(result).toBe(2);
        });

        it('should handle retry failures gracefully', async () => {
            const mockFailedJobs = [
                { id: 'job1', retry: jest.fn().mockRejectedValue(new Error('Retry failed')) },
                { id: 'job2', retry: jest.fn().mockResolvedValue(undefined) },
            ];

            mockEventsQueue.getFailed.mockResolvedValue(mockFailedJobs);

            const result = await service.retryFailedJobs('events');

            expect(loggerService.error).toHaveBeenCalledWith(
                'Failed to retry job job1',
                expect.any(Error)
            );
            expect(result).toBe(1); // Only one job successfully retried
        });
    });
});
