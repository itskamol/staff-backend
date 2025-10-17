import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config/gateway-config.module';
import { BufferModule } from '../buffer/buffer.module';
import { CollectorController } from './collector.controller';
import { CollectorService } from './collector.service';

@Module({
    imports: [GatewayConfigModule, BufferModule],
    controllers: [CollectorController],
    providers: [CollectorService],
})
export class CollectorModule {}
