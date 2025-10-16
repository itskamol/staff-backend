import { Module } from '@nestjs/common';
import { BaselineMeasurementService } from './baseline-measurement.service';
import { SharedDatabaseModule } from '@shared/database';

@Module({
  imports: [SharedDatabaseModule],
  providers: [BaselineMeasurementService],
  exports: [BaselineMeasurementService],
})
export class MetricsModule {}