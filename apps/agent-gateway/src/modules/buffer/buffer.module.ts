import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config/gateway-config.module';
import { GatewayBufferService } from './gateway-buffer.service';

@Module({
    imports: [GatewayConfigModule],
    providers: [GatewayBufferService],
    exports: [GatewayBufferService],
})
export class BufferModule {}
