import { Global, Module } from '@nestjs/common';
import { WinstonModule, WinstonModuleOptions } from 'nest-winston';
import { WinstonConfig } from '@/core/logger/winston.config';
import { LoggerService } from './services/logger.service';
import { DataSanitizerService } from '@/shared/services/data-sanitizer.service';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
    imports: [
        WinstonModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: async (
                configService: ConfigService,

            ): Promise<WinstonModuleOptions> => {
                const loggerConfig = new WinstonConfig(configService);
                return loggerConfig.initialize();
            },
            inject: [ConfigService],
        }),
    ],
    providers: [LoggerService, DataSanitizerService],
    exports: [LoggerService],
})
export class LoggerModule {}
