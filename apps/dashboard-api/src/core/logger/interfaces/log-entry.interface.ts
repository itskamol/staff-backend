export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context?: any;
    correlationId?: string;
    userId?: string;
    organizationId?: string;
    module?: string;
}

export interface LogContext {
    // Core identification fields
    correlationId?: string;
    userId?: string;
    organizationId?: number;
    module?: string;

    // Request context
    method?: string;
    url?: string;
    statusCode?: number;
    responseTime?: number;

    // Error context
    error?: string;
    trace?: string;
    exceptionType?: string;

    // Business context
    action?: string;
    businessEvent?: string;
    eventData?: any;

    // Performance context
    operation?: string;
    duration?: number;

    // System context
    timestamp?: Date;
    level?: LogLevel;
    ip?: string;
    userAgent?: string;

    // Type indicators
    requestType?: 'api-request' | 'api-error' | 'business-event' | 'performance' | 'audit';
    eventType?: string;
    performanceType?: string;

    // Flexible metadata
    [key: string]: any;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LogFormatterOptions {
    colorize?: boolean;
    includeTimestamp?: boolean;
    includeContext?: boolean;
}
