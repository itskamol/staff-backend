import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import { PaginationService } from './services/pagination.service';
import { MorganLoggerMiddleware } from './middleware/morgan-logger.middleware';
import { FILE_STORAGE_SERVICE, IFileStorageService } from './storage/file-storage.interface';
import { LocalFileStorageService } from './storage/local-file-storage.service';

@Module({
    imports: [ConfigModule],
    providers: [
        PaginationService,
        MorganLoggerMiddleware,
        {
            provide: FILE_STORAGE_SERVICE,
            inject: [ConfigService],
            useFactory: (configService: ConfigService): IFileStorageService => {
                const driver = configService.get<string>('STORAGE_DRIVER', 'local');
                const basePath = configService.get<string>(
                    'STORAGE_BASE_PATH',
                    path.resolve(process.cwd(), 'storage')
                );

                if (driver !== 'local') {
                    throw new Error(
                        `Unsupported storage driver "${driver}" for FILE_STORAGE_SERVICE`
                    );
                }

                return new LocalFileStorageService(basePath);
            },
        },
    ],
    exports: [
        PaginationService,
        MorganLoggerMiddleware,
        FILE_STORAGE_SERVICE,
    ],
})
export class SharedCommonModule {}
