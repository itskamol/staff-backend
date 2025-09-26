import { Injectable, LoggerService as NestLoggerService, Scope } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export interface LogContext {
  userId?: number;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements NestLoggerService {
  private context?: string;
  private logLevel: LogLevel;

  constructor(private readonly configService: AppConfigService) {
    this.logLevel = this.configService.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    this.printMessage(message, LogLevel.INFO, context);
  }

  error(message: any, trace?: string, context?: string) {
    this.printMessage(message, LogLevel.ERROR, context, trace);
  }

  warn(message: any, context?: string) {
    this.printMessage(message, LogLevel.WARN, context);
  }

  debug(message: any, context?: string) {
    if (this.logLevel >= LogLevel.DEBUG) {
      this.printMessage(message, LogLevel.DEBUG, context);
    }
  }

  verbose(message: any, context?: string) {
    if (this.logLevel >= LogLevel.VERBOSE) {
      this.printMessage(message, LogLevel.VERBOSE, context);
    }
  }

  logWithContext(level: LogLevel, message: string, logContext?: LogContext, context?: string) {
    if (this.logLevel >= level) {
      const contextInfo = this.formatContext(logContext);
      this.printMessage(`${message} ${contextInfo}`, level, context);
    }
  }

  logRequest(method: string, url: string, statusCode: number, responseTime: number, logContext?: LogContext) {
    const message = `${method} ${url} ${statusCode} - ${responseTime}ms`;
    this.logWithContext(LogLevel.INFO, message, logContext, 'HTTP');
  }

  logDatabaseQuery(query: string, duration: number, context?: string) {
    if (this.configService.isDevelopment) {
      this.logWithContext(LogLevel.DEBUG, `Query executed in ${duration}ms: ${query}`, {}, context || 'Database');
    }
  }

  logSecurityEvent(event: string, logContext?: LogContext) {
    this.logWithContext(LogLevel.WARN, `Security Event: ${event}`, logContext, 'Security');
  }

  logBusinessEvent(event: string, logContext?: LogContext) {
    this.logWithContext(LogLevel.INFO, `Business Event: ${event}`, logContext, 'Business');
  }

  private printMessage(message: any, level: LogLevel, context?: string, trace?: string) {
    const timestamp = new Date().toISOString();
    const contextStr = context || this.context || 'Application';
    const levelStr = LogLevel[level];
    
    const logEntry = {
      timestamp,
      level: levelStr,
      context: contextStr,
      message: typeof message === 'object' ? JSON.stringify(message) : message,
      ...(trace && { trace }),
    };

    // In production, you might want to send logs to external service
    if (this.configService.isProduction) {
      // TODO: Send to external logging service (e.g., Winston, Elasticsearch, etc.)
      console.log(JSON.stringify(logEntry));
    } else {
      // Development logging with colors
      const colors = {
        [LogLevel.ERROR]: '\x1b[31m', // Red
        [LogLevel.WARN]: '\x1b[33m',  // Yellow
        [LogLevel.INFO]: '\x1b[36m',  // Cyan
        [LogLevel.DEBUG]: '\x1b[35m', // Magenta
        [LogLevel.VERBOSE]: '\x1b[37m', // White
      };
      
      const resetColor = '\x1b[0m';
      const color = colors[level] || resetColor;
      
      console.log(
        `${color}[${timestamp}] [${levelStr}] [${contextStr}]${resetColor} ${logEntry.message}`
      );
      
      if (trace) {
        console.log(`${color}${trace}${resetColor}`);
      }
    }
  }

  private formatContext(logContext?: LogContext): string {
    if (!logContext) return '';
    
    const contextParts: string[] = [];
    
    if (logContext.userId) contextParts.push(`userId=${logContext.userId}`);
    if (logContext.requestId) contextParts.push(`requestId=${logContext.requestId}`);
    if (logContext.ip) contextParts.push(`ip=${logContext.ip}`);
    
    return contextParts.length > 0 ? `[${contextParts.join(', ')}]` : '';
  }
}