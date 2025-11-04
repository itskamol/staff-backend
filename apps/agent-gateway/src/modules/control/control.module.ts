import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config/gateway-config.module';
import { BufferModule } from '../buffer/buffer.module';
import { ControlChannelService } from './control.service';

import { CommandModule } from '../command/command.module';

@Module({
    imports: [GatewayConfigModule, BufferModule, CommandModule],
    providers: [ControlChannelService],
    exports: [ControlChannelService],
})
export class ControlModule {}
