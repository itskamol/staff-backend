import { Test, TestingModule } from '@nestjs/testing';
import { DeviceEventData, NotificationData, QueueProducer } from './queue.producer';
import { QueueService } from './queue.service';

describe('QueueProducer', () => {
    let producer: QueueProducer;
    let queueService: jest.Mocked<QueueService>;

    beforeEach(async () => {
        const mockQueueService = {
            addEventJob: jest.fn(),
            addNotificationJob: jest.fn(),
            addExportJob: jest.fn(),
            addSystemHealthJob: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                QueueProducer,
                {
                    provide: QueueService,
                    useValue: mockQueueService,
                },
            ],
        }).compile();

        producer = module.get<QueueProducer>(QueueProducer);
        queueService = module.get(QueueService);
    });

    it('should be defined', () => {
        expect(producer).toBeDefined();
    });

    describe('processRawDeviceEvent', () => {
        it('should add device event job with high priority', async () => {
            const eventData: DeviceEventData = {
                deviceId: 'device-123',
                eventType: 'access_attempt',
                timestamp: new Date(),
                rawData: { cardId: 'card-456' },
                organizationId: 'org-123',
                branchId: 'branch-123',
            };

            const mockJob = { id: 'job-123' };
            queueService.addEventJob.mockResolvedValue(mockJob as any);

            const result = await producer.processRawDeviceEvent(eventData);

            expect(queueService.addEventJob).toHaveBeenCalledWith(
                'process-raw-device-event',
                eventData,
                {
                    priority: 10,
                }
            );
            expect(result).toBe(mockJob);
        });
    });

    describe('processAttendanceCalculation', () => {
        it('should add attendance calculation job', async () => {
            const attendanceData = {
                employeeId: 'emp-123',
                date: new Date(),
                organizationId: 'org-123',
                branchId: 'branch-123',
            };

            const mockJob = { id: 'job-456' };
            queueService.addEventJob.mockResolvedValue(mockJob as any);

            const result = await producer.processAttendanceCalculation(attendanceData);

            expect(queueService.addEventJob).toHaveBeenCalledWith(
                'process-attendance-calculation',
                attendanceData,
                { priority: 8 }
            );
            expect(result).toBe(mockJob);
        });
    });

    describe('sendNotification', () => {
        it('should add notification job with correct priority', async () => {
            const notificationData: NotificationData = {
                type: 'email',
                recipient: 'user@example.com',
                subject: 'Test Subject',
                message: 'Test message',
                organizationId: 'org-123',
                priority: 'high',
            };

            const mockJob = { id: 'job-789' };
            queueService.addNotificationJob.mockResolvedValue(mockJob as any);

            const result = await producer.sendNotification(notificationData);

            expect(queueService.addNotificationJob).toHaveBeenCalledWith(
                'send-notification',
                notificationData,
                { priority: 8 } // High priority maps to 8
            );
            expect(result).toBe(mockJob);
        });

        it('should use default priority for normal notifications', async () => {
            const notificationData: NotificationData = {
                type: 'sms',
                recipient: '+1234567890',
                message: 'Test SMS',
                organizationId: 'org-123',
            };

            const mockJob = { id: 'job-101' };
            queueService.addNotificationJob.mockResolvedValue(mockJob as any);

            await producer.sendNotification(notificationData);

            expect(queueService.addNotificationJob).toHaveBeenCalledWith(
                'send-notification',
                notificationData,
                { priority: 5 } // Default priority
            );
        });
    });

    describe('sendBulkNotifications', () => {
        it('should send multiple notifications', async () => {
            const notifications: NotificationData[] = [
                {
                    type: 'email',
                    recipient: 'user1@example.com',
                    message: 'Message 1',
                    organizationId: 'org-123',
                },
                {
                    type: 'email',
                    recipient: 'user2@example.com',
                    message: 'Message 2',
                    organizationId: 'org-123',
                },
            ];

            const mockJobs = [{ id: 'job-1' }, { id: 'job-2' }];
            queueService.addNotificationJob
                .mockResolvedValueOnce(mockJobs[0] as any)
                .mockResolvedValueOnce(mockJobs[1] as any);

            const results = await producer.sendBulkNotifications(notifications);

            expect(queueService.addNotificationJob).toHaveBeenCalledTimes(2);
            expect(results).toHaveLength(2);
        });
    });

    describe('generateReport', () => {
        it('should add report generation job', async () => {
            const exportData = {
                type: 'attendance' as const,
                format: 'xlsx' as const,
                filters: { branchId: 'branch-123' },
                requestedBy: 'user-123',
                organizationId: 'org-123',
                userId: '12332112',
                reportId: 'asdasdasdsa',
                parameters: [],
            };

            const mockJob = { id: 'job-report' };
            queueService.addExportJob.mockResolvedValue(mockJob as any);

            const result = await producer.generateReport(exportData);

            expect(queueService.addExportJob).toHaveBeenCalledWith('generate-report', exportData, {
                priority: 5,
            });
            expect(result).toBe(mockJob);
        });
    });

    describe('scheduleHealthCheck', () => {
        it('should schedule recurring health check', async () => {
            const healthData = {
                checkType: 'database' as const,
                threshold: 80,
            };

            const mockJob = { id: 'job-health' };
            queueService.addSystemHealthJob.mockResolvedValue(mockJob as any);

            const result = await producer.scheduleHealthCheck(healthData);

            expect(queueService.addSystemHealthJob).toHaveBeenCalledWith(
                'health-check',
                healthData,
                {
                    repeat: {
                        pattern: '*/5 * * * *', // Every 5 minutes
                    },
                }
            );
            expect(result).toBe(mockJob);
        });
    });

    describe('processGuestVisitExpiration', () => {
        it('should schedule guest visit expiration with correct delay', async () => {
            const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
            const visitData = {
                visitId: 'visit-123',
                guestId: 'guest-456',
                organizationId: 'org-123',
                branchId: 'branch-123',
                expiresAt: futureDate,
            };

            const mockJob = { id: 'job-expiration' };
            queueService.addEventJob.mockResolvedValue(mockJob as any);

            const result = await producer.processGuestVisitExpiration(visitData);

            expect(queueService.addEventJob).toHaveBeenCalledWith(
                'process-guest-visit-expiration',
                visitData,
                {
                    delay: expect.any(Number),
                    priority: 6,
                }
            );

            // Check that delay is approximately 1 hour (allowing for small timing differences)
            const calledOptions = queueService.addEventJob.mock.calls[0][2];
            expect(calledOptions.delay).toBeGreaterThan(3590000); // 59.8 minutes
            expect(calledOptions.delay).toBeLessThan(3610000); // 60.2 minutes

            expect(result).toBe(mockJob);
        });

        it('should handle past expiration dates', async () => {
            const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
            const visitData = {
                visitId: 'visit-123',
                guestId: 'guest-456',
                organizationId: 'org-123',
                branchId: 'branch-123',
                expiresAt: pastDate,
            };

            const mockJob = { id: 'job-expiration' };
            queueService.addEventJob.mockResolvedValue(mockJob as any);

            await producer.processGuestVisitExpiration(visitData);

            const calledOptions = queueService.addEventJob.mock.calls[0][2];
            expect(calledOptions.delay).toBe(0); // Should be 0 for past dates
        });
    });

    describe('processBiometricMatching', () => {
        it('should add biometric matching job with very high priority', async () => {
            const biometricData = {
                deviceId: 'device-123',
                biometricData: 'encoded-biometric-data',
                organizationId: 'org-123',
                branchId: 'branch-123',
                timestamp: new Date(),
            };

            const mockJob = { id: 'job-biometric' };
            queueService.addEventJob.mockResolvedValue(mockJob as any);

            const result = await producer.processBiometricMatching(biometricData);

            expect(queueService.addEventJob).toHaveBeenCalledWith(
                'process-biometric-matching',
                biometricData,
                { priority: 9 }
            );
            expect(result).toBe(mockJob);
        });
    });
});
