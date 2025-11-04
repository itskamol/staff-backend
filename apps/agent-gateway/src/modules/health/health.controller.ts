import { Controller, Get } from '@nestjs/common';
import { GatewayConfigService } from '../../config/gateway-config.service';
import { GatewayBufferService } from '../buffer/gateway-buffer.service';
import { ControlChannelService } from '../control/control.service';
import { UplinkService } from '../uplink/uplink.service';
import { CommandExecutorService } from '../command/command-executor.service';

@Controller('health')
export class HealthController {
    constructor(
        private readonly config: GatewayConfigService,
        private readonly buffer: GatewayBufferService,
        private readonly controlChannel: ControlChannelService,
        private readonly uplink: UplinkService,
        private readonly commands: CommandExecutorService
    ) {}

    @Get()
    async getHealth() {
        const snapshot = await this.buffer.getSnapshot();

        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            gatewayId: this.config.gatewayId,
            organizationId: this.config.organizationId,
            buffer: snapshot,
            uplink: this.uplink.getStatus(),
            controlChannel: this.controlChannel.getStatus(),
            commands: this.commands.getMetrics(),
        };
    }
}
