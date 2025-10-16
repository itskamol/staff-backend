import { Module } from '@nestjs/common';
import { BufferService } from './buffer.service';
import { DiskMonitoringService } from './disk-monitoring.service';
import { BackPressureService } from './back-pressure.service';
import { BufferCleanupService } from './buffer-cleanup.service';

@Module({
  providers: [
    BufferService,
    DiskMonitoringService,
    BackPressureService,
    BufferCleanupService,
  ],
  exports: [BufferService, DiskMonitoringService, BackPressureService],
})
export class BufferModule {}