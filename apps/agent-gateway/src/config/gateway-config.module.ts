import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GatewayConfigService } from './gateway-config.service';

@Global()
@Module({
    imports: [ConfigModule],
    providers: [GatewayConfigService],
    exports: [GatewayConfigService],
})
export class GatewayConfigModule {}
