import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { QueueProducer } from './queue.producer';
import { QueueController } from './queue.controller';
import { QueueMonitorProcessor } from './queue.monitor';
import { LoggerModule } from '../logger/logger.module';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';

@Module({
    imports: [
        ConfigModule,
        LoggerModule,
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => {
                const redisUrl = configService.redisUrl;

                return {
                    connection: {
                        url: redisUrl,
                    },
                    defaultJobOptions: {
                        removeOnComplete: 100,
                        removeOnFail: 50,
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 2000,
                        },
                    },
                };
            },
            inject: [ConfigService],
        }),
        BullModule.registerQueue(
            { name: 'events' },
            { name: 'notifications' },
            { name: 'exports' },
            { name: 'system-health' }
        ),
    ],
    controllers: [QueueController],
    providers: [QueueService, QueueProducer, QueueMonitorProcessor],
    exports: [QueueService, QueueProducer, BullModule],
})
export class QueueModule {}
