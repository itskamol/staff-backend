import { Module } from '@nestjs/common';
import { GatewayController } from './controllers/gateway.controller';
import { GatewayIngestService } from './services/gateway-ingest.service';
import { GatewayConfigService } from './services/gateway-config.service';
import { GatewayApiKeyGuard } from './guards/gateway-api-key.guard';
import { GatewayControlGateway } from './services/gateway-control.gateway';
import { GatewayRegistryService } from './services/gateway-registry.service';
import { GatewayCommandService } from './services/gateway-command.service';
import { GatewayCommandsController } from './controllers/gateway-commands.controller';

@Module({
    controllers: [GatewayController, GatewayCommandsController],
    providers: [
        GatewayConfigService,
        GatewayIngestService,
        GatewayApiKeyGuard,
        GatewayControlGateway,
        GatewayRegistryService,
        GatewayCommandService,
    ],
    exports: [GatewayRegistryService, GatewayCommandService, GatewayControlGateway],
})
export class GatewayModule {}
