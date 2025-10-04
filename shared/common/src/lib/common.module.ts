import { Module } from '@nestjs/common';
import { PaginationService } from './services/pagination.service';
import { MorganLoggerMiddleware } from './middleware/morgan-logger.middleware';

@Module({
    providers: [
        PaginationService,
        MorganLoggerMiddleware,
    ],
    exports: [
        PaginationService,
        MorganLoggerMiddleware,
    ],
})
export class SharedCommonModule {}