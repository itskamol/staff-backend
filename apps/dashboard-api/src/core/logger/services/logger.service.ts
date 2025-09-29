import {
    Inject,
    Injectable,
    LoggerService as NestLoggerService,
    OnModuleDestroy,
    Optional,
} from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { LogContext, LogLevel } from '../interfaces/log-entry.interface';
import { DataSanitizerService } from 'apps/dashboard-api/src/shared/services/data-sanitizer.service';

@Injectable()
export class LoggerService implements NestLoggerService, OnModuleDestroy {
    private isShuttingDown = false;

    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly dataSanitizer: DataSanitizerService,
        @Optional() private readonly errorMonitoring?: any
    ) {}

    onModuleDestroy() {
        this.isShuttingDown = true;
    }

    private getContext(context?: string | LogContext): LogContext {
        if (typeof context === 'string') {
            return { module: context };
        }
        return context || {};
    }

    private formatMessage(message: any): string {
        if (typeof message === 'string') return message;
        if (typeof message === 'object') {
            try {
                return JSON.stringify(this.dataSanitizer.sanitizeForLogging(message));
            } catch {
                return JSON.stringify(message);
            }
        }
        return String(message);
    }

    private logToWinston(level: LogLevel, message: string, context: LogContext): void {
        try {
            // Sanitize context and add timestamp
            const sanitizedContext = {
                timestamp: new Date(),
                module: context.module || 'app',
                ...this.dataSanitizer.sanitizeForLogging(context),
            };

            this.logger[level](message, { context: sanitizedContext });
        } catch (error) {
            // Fallback to console if Winston fails
            console[level === 'info' ? 'log' : level](
                `${level.toUpperCase()}: ${message || error.message}`,
                context
            );
        }
    }

    // Core NestJS Logger interface methods
    log(message: any, context?: string | LogContext): void {
        const logContext = this.getContext(context);
        const formattedMessage = this.formatMessage(message);
        this.logToWinston('info', formattedMessage, logContext);
    }

    error(message: any, trace?: string, context?: string | LogContext): void {
        const logContext = { ...this.getContext(context), ...(trace && { trace }) };
        const formattedMessage = this.formatMessage(message);

        // Record error for monitoring
        this.errorMonitoring
            ?.recordError?.(logContext.module || 'unknown', formattedMessage, logContext)
            .catch(() => {}); // Silent fail

        this.logToWinston('error', formattedMessage, logContext);
    }

    warn(message: any, context?: string | LogContext): void {
        const logContext = this.getContext(context);
        const formattedMessage = this.formatMessage(message);
        this.logToWinston('warn', formattedMessage, logContext);
    }

    debug(message: any, context?: string | LogContext): void {
        const logContext = this.getContext(context);
        const formattedMessage = this.formatMessage(message);
        this.logToWinston('debug', formattedMessage, logContext);
    }

    verbose(message: any, context?: string | LogContext): void {
        const logContext = this.getContext(context);
        const formattedMessage = this.formatMessage(message);
        this.logToWinston('verbose', formattedMessage, logContext);
    }

    // Utility methods for common scenarios
    logUserAction(userId: number, action: string, details?: any): void {
        this.log(`User action: ${action}`, {
            module: 'user-action',
            userId,
            action,
            ...details,
        });
    }

    logApiError(
        method: string,
        url: string,
        statusCode: number,
        error: string,
        context?: LogContext
    ): void {
        const errorContext = {
            module: 'api',
            method,
            url,
            statusCode,
            ...context,
        };

        this.errorMonitoring?.recordError?.('api', error, errorContext).catch(() => {});
        this.error(
            `API Request failed: ${method} ${url} - ${statusCode} - ${error}`,
            errorContext.trace,
            errorContext
        );
        console.error(errorContext);
    }
}
