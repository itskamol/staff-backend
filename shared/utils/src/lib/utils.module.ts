import { Module } from '@nestjs/common';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { DataSanitizerService } from './sanitization/data-sanitizer.service';

@Module({
    providers: [
        ResponseInterceptor, 
        GlobalExceptionFilter,
        DataSanitizerService,
    ],
    exports: [
        ResponseInterceptor, 
        GlobalExceptionFilter,
        DataSanitizerService,
    ],
})
export class SharedUtilsModule {}
