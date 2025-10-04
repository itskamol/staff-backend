import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import morgan from 'morgan';

@Injectable()
export class MorganLoggerMiddleware implements NestMiddleware {
    private morganInstance: any;
    private readonly logger = new Logger(MorganLoggerMiddleware.name);

    constructor() {
        morgan.format('custom', (tokens, req: Request, res) => {
            const status = parseInt(tokens.status(req, res) || '500');

            if (status >= 500) {
                return '';
            }

            if (status >= 400) {
                return '';
            }

            const userContext = req.user as any;
            const responseTime = parseFloat(tokens['response-time'](req, res) || '0');

            const logContext = {
                module: 'HTTP',
                method: tokens.method(req, res),
                url: tokens.url(req, res),
                statusCode: status,
                responseTime,
                userAgent: tokens['user-agent'](req, res),
                userId: userContext?.sub || userContext?.id,
                organizationId: userContext?.organizationId,
                ip: req.ip || req.socket?.remoteAddress,
                contentLength: tokens.res(req, res, 'content-length') || '0',
                referrer: tokens.referrer(req, res) || '-',
            };

            const message = `${logContext.method} ${logContext.url} - ${status} (${responseTime}ms)`;

            this.logger.log(message);

            return '';
        });

        this.morganInstance = morgan('custom', {
            stream: { write: () => { } },
        });
    }

    use(req: Request, res: Response, next: NextFunction): void {
        this.morganInstance(req, res, next);
    }
}