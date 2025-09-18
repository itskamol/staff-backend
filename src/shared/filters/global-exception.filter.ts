import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { LoggerService } from '@/core/logger';
import { RequestWithCorrelation } from '../middleware/correlation-id.middleware';
import { ApiErrorDto, ApiErrorResponse } from '../dto/api-response.dto';
import { CustomValidationException } from '../exceptions/validation.exception';
import { XmlJsonService } from '../services/xml-json.service';
import { ConfigService } from '@/core/config/config.service';
import { UserContext } from '../interfaces';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly logger: LoggerService,
        private readonly xmlService: XmlJsonService,
        private readonly configService: ConfigService
    ) {}

    async catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<RequestWithCorrelation>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        const error: ApiErrorDto = {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred.',
        };

        if (exception instanceof CustomValidationException) {
            status = HttpStatus.BAD_REQUEST;
            const validationResponse = exception.getResponse() as any;
            error.code = 'VALIDATION_ERROR';
            error.message = 'Validation failed';
            error.details = validationResponse.errors;
        } else if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            error.code = this.getErrorCodeFromStatus(status);

            if (typeof exceptionResponse === 'string') {
                if (exceptionResponse.includes('<?xml')) {
                    error.message = await this.xmlService.xmlToJsonClean(exceptionResponse);
                } else {
                    error.message = exceptionResponse;
                }
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const responseAsObject = exceptionResponse as { message?: any; error?: string };
                if (responseAsObject.message) {
                    error.message = Array.isArray(responseAsObject.message)
                        ? responseAsObject.message.join(', ')
                        : responseAsObject.message;
                } else if (responseAsObject.error) {
                    error.message = responseAsObject.error;
                }
            }
        } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            switch (exception.code) {
                case 'P2000': // Value too long for column
                    status = HttpStatus.BAD_REQUEST;
                    error.code = 'VALUE_TOO_LONG';
                    error.message = `The value provided for the field '${exception.meta?.target}' is too long.`;
                    break;

                case 'P2002': // Unique constraint failed
                    status = HttpStatus.CONFLICT;
                    error.code = 'UNIQUE_CONSTRAINT_VIOLATION';
                    error.message = `A record with this value already exists.`;
                    error.details = {
                        target: exception.meta?.target,
                    };
                    break;

                case 'P2003': // Foreign key constraint failed
                    status = HttpStatus.CONFLICT;
                    error.code = 'FOREIGN_KEY_CONSTRAINT_VIOLATION';
                    error.message = `The operation failed because it violates a foreign key constraint on the field '${exception.meta?.field_name}'.`;
                    break;

                case 'P2011': // Null constraint violation
                    status = HttpStatus.BAD_REQUEST;
                    error.code = 'NULL_CONSTRAINT_VIOLATION';
                    error.message = `A required field '${exception.meta?.target}' was not provided.`;
                    break;

                case 'P2025': // Record to update/delete not found
                    status = HttpStatus.NOT_FOUND;
                    error.code = 'RESOURCE_NOT_FOUND';
                    error.message =
                        (exception.meta?.cause as string) ||
                        'The requested resource could not be found.';
                    break;

                default:
                    status = HttpStatus.INTERNAL_SERVER_ERROR;
                    error.code = 'DATABASE_ERROR';
                    error.message = 'A database error occurred.';
                    this.logger.warn(
                        `Unhandled Prisma Error Code: ${exception.code}`,
                        exception.stack
                    );
                    break;
            }
        } else if (exception instanceof Error) {
            error.message = exception.message;
        }

        const userContext = request.user as UserContext;
        const startTime = (request as any).startTime || Date.now();
        const responseTime = Date.now() - startTime;

        this.logger.logApiError(request.method, request.url, status, error.message, {
            userId: userContext?.sub,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
            responseTime,
            trace: exception instanceof Error ? exception.stack : String(exception),
            exceptionType: exception?.constructor?.name || 'Unknown',
            details: error.details,
        });

        if (this.configService.isDevelopment) {
            this.enhanceErrorForDevelopment(error, exception, request);
        }

        if (status === HttpStatus.INTERNAL_SERVER_ERROR && this.configService.isProduction) {
            error.message = 'An unexpected internal error occurred.';
            error.details = undefined;
        }

        const errorResponse = new ApiErrorResponse(error);
        response.status(status).json(errorResponse);
    }

    private enhanceErrorForDevelopment(error: ApiErrorDto, exception: unknown, request: RequestWithCorrelation): void {
        const developmentDetails: any = error.details || {};

        if (exception instanceof Error && exception.stack) {
            developmentDetails.stackTrace = exception.stack.split('\n');
        }

        developmentDetails.request = {
            method: request.method,
            url: request.url,
            headers: this.sanitizeHeaders(request.headers),
            query: request.query,
            params: request.params,
            body: this.sanitizeRequestBody(request.body),
            correlationId: request.correlationId,
            timestamp: new Date().toISOString(),
        };

        // Exception type va ma'lumotlari
        if (exception) {
            developmentDetails.exception = {
                type: exception.constructor?.name || 'Unknown',
                message: exception instanceof Error ? exception.message : String(exception),
            };

            if (exception instanceof Prisma.PrismaClientKnownRequestError) {
                developmentDetails.exception.prisma = {
                    code: exception.code,
                    meta: exception.meta,
                    clientVersion: exception.clientVersion,
                };
            }

            if (exception instanceof HttpException) {
                const response = exception.getResponse();
                developmentDetails.exception.httpException = {
                    status: exception.getStatus(),
                    response: typeof response === 'object' ? response : { message: response },
                };
            }
        }

        error.details = developmentDetails;
    }

    private sanitizeHeaders(headers: any): any {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        const sanitized = { ...headers };
        
        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    private sanitizeRequestBody(body: any): any {
        if (!body || typeof body !== 'object') {
            return body;
        }

        const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential'];
        const sanitized = { ...body };
        
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    private getErrorCodeFromStatus(status: number): string {
        switch (status) {
            case HttpStatus.BAD_REQUEST:
                return 'BAD_REQUEST';
            case HttpStatus.UNAUTHORIZED:
                return 'UNAUTHORIZED';
            case HttpStatus.FORBIDDEN:
                return 'FORBIDDEN_RESOURCE';
            case HttpStatus.NOT_FOUND:
                return 'RESOURCE_NOT_FOUND';
            case HttpStatus.CONFLICT:
                return 'RESOURCE_CONFLICT';
            default:
                return 'SERVER_ERROR';
        }
    }
}
