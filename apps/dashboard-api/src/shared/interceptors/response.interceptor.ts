import {
    CallHandler,
    ExecutionContext,
    HttpStatus,
    Injectable,
    NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiMetaDto, ApiPaginatedResponse, ApiSuccessResponse } from '../dto/api-response.dto';
import { PaginationResponseDto } from '../dto/pagination.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {

        const httpContext = context.switchToHttp();
        const response = httpContext.getResponse();

        return next.handle().pipe(
            map(data => {
                // For 204 No Content, NestJS returns an empty string.
                // We'll transform it into a standard success response with null data.
                if (response.statusCode === HttpStatus.NO_CONTENT || data === undefined) {
                    response.status(HttpStatus.OK); // Change status to 200 for a consistent body
                    return new ApiSuccessResponse(null);
                }

                // Handle paginated data by checking for pagination properties
                if (
                    data &&
                    typeof data === 'object' &&
                    'data' in data &&
                    'total' in data &&
                    'page' in data &&
                    'limit' in data
                ) {
                    const paginatedData = data as PaginationResponseDto<any>;
                    const meta = new ApiMetaDto();
                    meta.limit = paginatedData.limit;
                    meta.total = paginatedData.total;
                    meta.page = paginatedData.page;

                    return new ApiPaginatedResponse(paginatedData.data, meta);
                }

                // Handle all other successful responses
                return new ApiSuccessResponse(data);
            })
        );
    }
}
