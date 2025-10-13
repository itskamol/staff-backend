import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import morgan, { TokenIndexer, StreamOptions, FormatFn } from 'morgan';

@Injectable()
export class MorganLoggerMiddleware implements NestMiddleware {
    private readonly morganInstance: (req: Request, res: Response, next: NextFunction) => void;
    private readonly logger = new Logger(MorganLoggerMiddleware.name);

    constructor() {
        const formatter: FormatFn<Request, Response> = (tokens: TokenIndexer<Request, Response>, req, res) => {
            const statusToken = tokens['status'];
            const status = parseInt(statusToken ? statusToken(req, res) || '500' : '500');

            if (status >= 500) {
                return '';
            }

            if (status >= 400) {
                return '';
            }

            const userContext = req.user as any;
            const responseTimeToken = tokens['response-time'];
            const responseTime = parseFloat(responseTimeToken ? responseTimeToken(req, res) || '0' : '0');

            const logContext = {
                module: 'HTTP',
                method: tokens['method']?.(req, res),
                url: tokens['url']?.(req, res),
                statusCode: status,
                responseTime,
                userAgent: tokens['user-agent']?.(req, res),
                userId: userContext?.sub || userContext?.id,
                organizationId: userContext?.organizationId,
                ip: req.ip || req.socket?.remoteAddress,
                contentLength: tokens['res']?.(req, res, 'content-length') || '0',
                referrer: tokens['referrer']?.(req, res) || '-',
            };

            const message = `${logContext.method} ${logContext.url} - ${status} (${responseTime}ms)`;

            this.logger.log(message);

            return '';
        };

        morgan.format('custom', formatter);

        const stream: StreamOptions = {
            write: () => {
                // Intentionally noop, logs handled via Nest logger above.
            },
        };

        this.morganInstance = morgan<Request, Response>('custom', { stream });
    }

    use(req: Request, res: Response, next: NextFunction): void {
        this.morganInstance(req, res, next);
    }
}