import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';

/**
 * Get environment file path based on NODE_ENV
 */
function getEnvFilePath(): string {
    const nodeEnv = process.env.NODE_ENV || 'development';

    const envFileMap: Record<string, string> = {
        prod: 'config/environments/.env.prod',
    };

    const envFile = envFileMap[nodeEnv] || 'config/environments/.env';

    return envFile;
}

@Module({
    imports: [
        NestConfigModule.forRoot({
            isGlobal: true,
            envFilePath: getEnvFilePath(),
            expandVariables: true,
            ignoreEnvFile: process.env.NODE_ENV === 'production',
        }),
    ],
    providers: [ConfigService],
    exports: [ConfigService],
})
export class ConfigModule {}
