import { Module } from '@nestjs/common';
import { ResponseInterceptor } from './interceptors/response.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Module({
    providers: [ResponseInterceptor, GlobalExceptionFilter],
    exports: [ResponseInterceptor, GlobalExceptionFilter],
})
export class SharedUtilsModule {}
