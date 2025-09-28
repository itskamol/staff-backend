import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config/config.service';
import { AppLoggerService } from './logger/logger.service';
import { CacheService } from './cache/cache.service';
import { QueueService } from './queue/queue.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [AppConfigService, AppLoggerService, CacheService, QueueService],
    exports: [AppConfigService, AppLoggerService, CacheService, QueueService],
})
export class CoreModule {}
