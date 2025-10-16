import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedDatabaseModule } from '@shared/database';
import { CollectorModule } from './collector/collector.module';
import { UplinkModule } from './uplink/uplink.module';
import { ControlChannelModule } from './control-channel/control-channel.module';
import { BufferModule } from './buffer/buffer.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    SharedDatabaseModule,
    CollectorModule,
    UplinkModule,
    ControlChannelModule,
    BufferModule,
    HealthModule,
  ],
})
export class AppModule {}