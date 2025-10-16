import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsService } from './metrics.service';
import { SystemMonitoringService } from './system-monitoring.service';
import { PerformanceTrackingService } from './performance-tracking.service';
import { BufferModule } from '../buffer/buffer.module';
import { UplinkModule } from '../uplink/uplink.module';
import { ControlChannelModule } from '../control-channel/control-channel.module';

@Module({
  imports: [
    TerminusModule,
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'agent_gateway_',
        },
      },
    }),
    BufferModule,
    UplinkModule,
    ControlChannelModule,
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    MetricsService,
    SystemMonitoringService,
    PerformanceTrackingService,
  ],
  exports: [
    HealthService,
    MetricsService,
    SystemMonitoringService,
    PerformanceTrackingService,
  ],
})
export class HealthModule {}