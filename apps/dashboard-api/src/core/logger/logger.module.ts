import { Global, Module } from '@nestjs/common';
import { WinstonModule, WinstonModuleOptions } from 'nest-winston';
import { LoggerService } from './services/logger.service';
import { ConfigService } from '../config/config.service';
import { ConfigModule } from '../config/config.module';
import { DataSanitizerService } from '../../shared/services/data-sanitizer.service';
import { WinstonConfig } from './winston.config';

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
