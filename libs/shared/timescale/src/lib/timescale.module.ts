import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TimescaleService } from './timescale.service';

@Module({
  imports: [ConfigModule],
  providers: [TimescaleService],
  exports: [TimescaleService],
})
export class TimescaleModule {}