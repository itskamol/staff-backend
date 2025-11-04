import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BufferModule } from '../modules/buffer/buffer.module';
import { CollectorModule } from '../modules/collector/collector.module';
import { ControlModule } from '../modules/control/control.module';
import { GatewayConfigModule } from '../config/gateway-config.module';
import { HealthModule } from '../modules/health/health.module';
import { UplinkModule } from '../modules/uplink/uplink.module';
import { CommandModule } from '../modules/command/command.module';
import { AdaptersModule } from '../modules/adapters/adapters.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env.gateway', '.env'],
        }),
        GatewayConfigModule,
        AdaptersModule,
        CommandModule,
        BufferModule,
        CollectorModule,
        ControlModule,
        UplinkModule,
        HealthModule,
    ],
})
export class AppModule {}
