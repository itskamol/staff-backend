import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { ConfigModule } from '../../core/config/config.module';
import { ConfigService } from '../../core/config/config.service';
import { QueueMonitorModule } from './bull-board.module';

@Module({
    imports: [
        BullModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                connection: {
                    host: configService.redisHost,
                    port: configService.redisPort,
                },
            }),
            inject: [ConfigService],
        }),

        BullBoardModule.forRoot({
            route: '/queues',
            adapter: ExpressAdapter,
        }),
        QueueMonitorModule
    ],
})
export class QueueModule { }
