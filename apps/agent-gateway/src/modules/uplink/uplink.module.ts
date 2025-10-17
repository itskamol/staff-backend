import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config/gateway-config.module';
import { BufferModule } from '../buffer/buffer.module';
import { UplinkService } from './uplink.service';

@Module({
    imports: [GatewayConfigModule, BufferModule],
    providers: [UplinkService],
    exports: [UplinkService],
})
export class UplinkModule {}
