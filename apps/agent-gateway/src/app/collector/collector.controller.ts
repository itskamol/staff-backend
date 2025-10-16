import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { MonitoringDataDto, DeviceEventDto, AgentHeartbeatDto } from './dto';

@Controller('collect')
export class CollectorController {
  private readonly logger = new Logger(CollectorController.name);

  constructor(private readonly collectorService: CollectorService) {}

  @Post('monitoring')
  @HttpCode(HttpStatus.ACCEPTED)
  async collectMonitoringData(
    @Body() data: MonitoringDataDto,
    @Headers('x-agent-id') agentId: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    this.logger.debug(`Received monitoring data from agent ${agentId}`);
    
    return await this.collectorService.processMonitoringData({
      ...data,
      agentId,
      organizationId: parseInt(organizationId),
      receivedAt: new Date(),
    });
  }

  @Post('device-events')
  @HttpCode(HttpStatus.ACCEPTED)
  async collectDeviceEvents(
    @Body() events: DeviceEventDto[],
    @Headers('x-agent-id') agentId: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    this.logger.debug(`Received ${events.length} device events from agent ${agentId}`);
    
    return await this.collectorService.processDeviceEvents(
      events.map(event => ({
        ...event,
        agentId,
        organizationId: parseInt(organizationId),
        receivedAt: new Date(),
      }))
    );
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async receiveHeartbeat(
    @Body() heartbeat: AgentHeartbeatDto,
    @Headers('x-agent-id') agentId: string,
    @Headers('x-organization-id') organizationId: string,
  ) {
    this.logger.debug(`Received heartbeat from agent ${agentId}`);
    
    return await this.collectorService.processHeartbeat({
      ...heartbeat,
      agentId,
      organizationId: parseInt(organizationId),
      receivedAt: new Date(),
    });
  }
}