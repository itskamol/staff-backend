import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config/gateway-config.module';
import { BufferModule } from '../buffer/buffer.module';
import { ControlModule } from '../control/control.module';
import { UplinkModule } from '../uplink/uplink.module';
import { CommandModule } from '../command/command.module';
import { HealthController } from './health.controller';

@Module({
    imports: [GatewayConfigModule, BufferModule, ControlModule, UplinkModule, CommandModule],
    controllers: [HealthController],
})
export class HealthModule {}
