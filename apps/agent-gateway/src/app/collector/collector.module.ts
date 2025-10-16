import { Module } from '@nestjs/common';
import { CollectorController } from './collector.controller';
import { CollectorService } from './collector.service';
import { DataValidationService } from './data-validation.service';
import { BufferModule } from '../buffer/buffer.module';

@Module({
  imports: [BufferModule],
  controllers: [CollectorController],
  providers: [CollectorService, DataValidationService],
  exports: [CollectorService],
})
export class CollectorModule {}