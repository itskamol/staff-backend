import { format, transports } from 'winston';
import * as Transport from 'winston-transport';
import DailyRotateFile from 'winston-daily-rotate-file';
import { WinstonModuleOptions } from 'nest-winston';
import { ConfigService } from '../config/config.service';
import * as fs from 'node:fs';
import * as path from 'node:path';

const { combine, timestamp, json, colorize, printf, errors } = format;

export class WinstonConfig {
    constructor(private readonly configService: ConfigService) {}

    private ensureLogDir(): void {
        const dir = path.resolve(process.cwd(), 'logs');
        fs.mkdirSync(dir, { recursive: true });
    }

    private devFormat(): any {
        return combine(
            colorize({ all: true }),
            timestamp({ format: 'DD-MM-YYYY HH:mm:ss.SSS' }),
            errors({ stack: true }),
            printf(({ level, message, timestamp, context, stack }) => {
                const ctx = context as any;
                const contextStr = ctx?.module ? ` [${ctx.module}]` : '';
                const msg = stack ? `${message}\n${stack}` : message;
                return `${timestamp}${contextStr} ${level}: ${msg}`;
            })
        );
    }

    private prodFormat(): any {
        return combine(
            timestamp(),
            errors({ stack: true }),
            json({
                replacer: (key, value) => {
                    if (typeof key === 'string' && /password|token|secret|api[-_]?key|authorization/i.test(key)) {
                        return '[REDACTED]';
                    }
                    return value;
                },
            })
        );
    }

    private rotateFileConfig = {
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        format: this.prodFormat(),
        maxFiles: '30d' as const,
    };

    private createTransports(): Transport[] {
        const list: Transport[] = [
            new transports.Console({
                level: this.configService.logLevel,
                format: this.configService.isProduction ? this.prodFormat() : this.devFormat(),
                // File log yoqilganida exception/rejection’larni faqat dedicated handlerlar oladi
                handleExceptions: !this.configService.enableFileLogging,
                handleRejections: !this.configService.enableFileLogging,
            }),
        ];

        if (this.configService.enableFileLogging) {
            this.ensureLogDir();

            // Combined logs
            list.push(
                new DailyRotateFile({
                    ...this.rotateFileConfig,
                    filename: 'logs/combined-%DATE%.log',
                    level: 'info',
                    maxSize: '50m',
                    auditFile: 'logs/.audit-combined.json',
                })
            );

            // Error-only logs (exceptionsni bu transportda tutmaymiz)
            list.push(
                new DailyRotateFile({
                    ...this.rotateFileConfig,
                    filename: 'logs/error-%DATE%.log',
                    level: 'error',
                    maxSize: '20m',
                    auditFile: 'logs/.audit-error.json',
                })
            );
        }

        return list;
    }

    initialize(): WinstonModuleOptions {
        return {
            level: this.configService.logLevel,
            transports: this.createTransports(),
            exitOnError: false,
            defaultMeta: {
                service: 'sector-staff',
                environment: this.configService.nodeEnv,
            },
            ...(this.configService.enableFileLogging && {
                exceptionHandlers: [
                    new DailyRotateFile({
                        ...this.rotateFileConfig,
                        filename: 'logs/exceptions-%DATE%.log',
                        maxSize: '20m',
                        maxFiles: '14d',
                        auditFile: 'logs/.audit-exceptions.json',
                    }),
                ],
                rejectionHandlers: [
                    new DailyRotateFile({
                        ...this.rotateFileConfig,
                        filename: 'logs/rejections-%DATE%.log',
                        maxSize: '20m',
                        maxFiles: '14d',
                        auditFile: 'logs/.audit-rejections.json',
                    }),
                ],
            }),
        };
    }
}