import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiSuccessResponse } from '../dto/api-response.dto';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
        return next.handle().pipe(
            map(data => {
                // If data is already a success response, return as is
                if (data instanceof ApiSuccessResponse) {
                    return data;
                }

                // Wrap data in success response
                return new ApiSuccessResponse(data);
            })
        );
    }
}
