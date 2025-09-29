import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiErrorDto, ApiErrorResponse } from '../dto/api-response.dto';
import { CustomValidationException } from '../exceptions/validation.exception';
import { UserContext } from '../interfaces';
import { LoggerService } from '../../core/logger';
import { ConfigService } from '../../core/config/config.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(
        private readonly logger: LoggerService,
        private readonly configService: ConfigService
    ) {}

    async catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

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

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
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

        if (status === HttpStatus.INTERNAL_SERVER_ERROR && this.configService.isProduction) {
            error.message = 'An unexpected internal error occurred.';
            error.details = undefined;
        }

        const errorResponse = new ApiErrorResponse(error);
        response.status(status).json(errorResponse);
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
