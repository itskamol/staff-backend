import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorResponse, ApiErrorDto } from '../dto/api-response.dto';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Internal server error';
        let code = 'INTERNAL_ERROR';
        let details: any = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                message = (exceptionResponse as any).message || exception.message;
                code = (exceptionResponse as any).error || 'HTTP_EXCEPTION';
                details = (exceptionResponse as any).details;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            code = 'APPLICATION_ERROR';
        }

        // Log the error
        this.logger.error(
            `${request.method} ${request.url} - ${status} - ${message}`,
            exception instanceof Error ? exception.stack : undefined
        );

        // Send error response
        const errorDto: ApiErrorDto = { code, message, details };
        const errorResponse = new ApiErrorResponse(errorDto);
        response.status(status).json(errorResponse);
    }
}
