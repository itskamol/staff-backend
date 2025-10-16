import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedDatabaseModule } from '@shared/database';
import { FileStorageFactory } from './file-storage.factory';
import { LocalFileStorageService } from './local-file-storage.service';
import { S3FileStorageService } from './s3-file-storage.service';
import { MinIOFileStorageService } from './minio-file-storage.service';
import { StorageMigrationService } from './storage-migration.service';
import { EncryptionService } from './encryption.service';
import { RetentionService } from './retention.service';
import { StorageTestingService } from './storage-testing.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot(), SharedDatabaseModule],
  providers: [
    FileStorageFactory,
    LocalFileStorageService,
    S3FileStorageService,
    MinIOFileStorageService,
    StorageMigrationService,
    EncryptionService,
    RetentionService,
    StorageTestingService,
  ],
  exports: [
    FileStorageFactory,
    LocalFileStorageService,
    S3FileStorageService,
    MinIOFileStorageService,
    StorageMigrationService,
    EncryptionService,
    RetentionService,
    StorageTestingService,
  ],
})
export class StorageModule {}