import { Injectable } from '@nestjs/common';
import { QueueJobData, QueueJobOptions, QueueService } from './queue.service';

export interface DeviceEventData extends QueueJobData {
    deviceId: string;
    eventType: string;
    timestamp: Date;
    rawData: any;
    organizationId: string;
    branchId: string;
    idempotencyKey?: string;
}

export interface NotificationData extends QueueJobData {
    type: 'email' | 'sms' | 'push';
    recipient: string;
    subject?: string;
    message: string;
    templateId?: string;
    templateData?: Record<string, any>;
    organizationId: string;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ExportData extends QueueJobData {
    type: 'attendance' | 'employees' | 'audit';
    format: 'csv' | 'xlsx' | 'pdf';
    filters: Record<string, any>;
    requestedBy: string;
    organizationId: string;
    branchIds?: string[];
    dateRange?: {
        from: Date;
        to: Date;
    };
}

export interface ReportGenerationData extends QueueJobData {
    reportId: string;
    type: string;
    format: string;
    parameters: any;
    organizationId: string;
    userId: string;
}

export interface SystemHealthData extends QueueJobData {
    checkType: 'database' | 'redis' | 'external-api' | 'disk-space' | 'memory';
    threshold?: number;
    organizationId?: string;
}

@Injectable()
export class QueueProducer {
    constructor(private readonly queueService: QueueService) {}

    /**
     * Process raw device event
     */
    async processRawDeviceEvent(data: DeviceEventData, options?: QueueJobOptions) {
        return this.queueService.addEventJob('process-raw-device-event', data, {
            ...options,
            priority: 10, // High priority for real-time events
        });
    }

    /**
     * Process attendance calculation
     */
    async processAttendanceCalculation(
        data: {
            employeeId: string;
            date: Date;
            organizationId: string;
            branchId: string;
        },
        options?: QueueJobOptions
    ) {
        return this.queueService.addEventJob('process-attendance-calculation', data, {
            ...options,
            priority: 8,
        });
    }

    /**
     * Send notification
     */
    async sendNotification(data: NotificationData, options?: QueueJobOptions) {
        const priority = this.getNotificationPriority(data.priority);

        return this.queueService.addNotificationJob('send-notification', data, {
            ...options,
            priority,
        });
    }

    /**
     * Send bulk notifications
     */
    async sendBulkNotifications(notifications: NotificationData[], options?: QueueJobOptions) {
        const jobs = notifications.map(notification =>
            this.sendNotification(notification, options)
        );

        return Promise.all(jobs);
    }

    /**
     * Generate report
     */
    async generateReport(data: ReportGenerationData, options?: QueueJobOptions) {
        return this.queueService.addExportJob('generate-report', data, {
            ...options,
            priority: 5, // Medium priority for reports
        });
    }

    /**
     * Export data
     */
    async exportData(data: ExportData, options?: QueueJobOptions) {
        return this.queueService.addExportJob('export-data', data, {
            ...options,
            priority: 3, // Lower priority for exports
        });
    }

    /**
     * Health check
     */
    async scheduleHealthCheck(data: SystemHealthData, options?: QueueJobOptions) {
        return this.queueService.addSystemHealthJob('health-check', data, {
            ...options,
            repeat: {
                pattern: '*/5 * * * *', // Every 5 minutes
            },
        });
    }

    /**
     * Database cleanup
     */
    async scheduleDatabaseCleanup(
        data: {
            tables: string[];
            retentionDays: number;
            organizationId?: string;
        },
        options?: QueueJobOptions
    ) {
        return this.queueService.addSystemHealthJob('database-cleanup', data, {
            ...options,
            repeat: {
                pattern: '0 2 * * *', // Daily at 2 AM
            },
        });
    }

    /**
     * Queue monitoring
     */
    async scheduleQueueMonitoring(options?: QueueJobOptions) {
        return this.queueService.addSystemHealthJob(
            'queue-monitoring',
            {},
            {
                ...options,
                repeat: {
                    pattern: '*/10 * * * *', // Every 10 minutes
                },
            }
        );
    }

    /**
     * Process guest visit expiration
     */
    async processGuestVisitExpiration(
        data: {
            visitId: string;
            guestId: string;
            organizationId: string;
            branchId: string;
            expiresAt: Date;
        },
        options?: QueueJobOptions
    ) {
        const delay = data.expiresAt.getTime() - Date.now();

        return this.queueService.addEventJob('process-guest-visit-expiration', data, {
            ...options,
            delay: Math.max(0, delay),
            priority: 6,
        });
    }

    /**
     * Process biometric matching
     */
    async processBiometricMatching(
        data: {
            deviceId: string;
            biometricData: string;
            organizationId: string;
            branchId: string;
            timestamp: Date;
        },
        options?: QueueJobOptions
    ) {
        return this.queueService.addEventJob('process-biometric-matching', data, {
            ...options,
            priority: 9, // Very high priority for biometric matching
        });
    }

    private getNotificationPriority(priority?: string): number {
        switch (priority) {
            case 'urgent':
                return 10;
            case 'high':
                return 8;
            case 'normal':
                return 5;
            case 'low':
                return 2;
            default:
                return 5;
        }
    }
}
