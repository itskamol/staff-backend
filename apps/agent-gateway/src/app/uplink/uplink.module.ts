import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UplinkService } from './uplink.service';
import { BatchProcessorService } from './batch-processor.service';
import { RetryService } from './retry.service';
import { IdempotencyService } from './idempotency.service';
import { UplinkHealthService } from './uplink-health.service';
import { BufferModule } from '../buffer/buffer.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds
      maxRedirects: 0,
    }),
    BufferModule,
  ],
  providers: [
    UplinkService,
    BatchProcessorService,
    RetryService,
    IdempotencyService,
    UplinkHealthService,
  ],
  exports: [UplinkService, BatchProcessorService, UplinkHealthService],
})
export class UplinkModule {}