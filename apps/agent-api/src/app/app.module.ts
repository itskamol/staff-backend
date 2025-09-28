import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';

import { SharedDatabaseModule } from '@app/shared/database';
import { SharedUtilsModule, ResponseInterceptor, GlobalExceptionFilter } from '@app/shared/utils';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AgentModule } from '../modules/agent/agent.module';
import { HIKVisionModule } from '../modules/hikvision/hikvision.module';
import { DataProcessingModule } from '../modules/data-processing/data-processing.module';
import { SecurityModule } from '../modules/security/security.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '.env.local'],
        }),
        SharedDatabaseModule,
        SharedUtilsModule,
        SecurityModule,
        AgentModule,
        HIKVisionModule,
        DataProcessingModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_INTERCEPTOR,
            useClass: ResponseInterceptor,
        },
        {
            provide: APP_FILTER,
            useClass: GlobalExceptionFilter,
        },
    ],
})
export class AppModule {}
