import { Module } from '@nestjs/common';
import { ControlChannelService } from './control-channel.service';
import { WebSocketClientService } from './websocket-client.service';
import { CommandProcessorService } from './command-processor.service';
import { HeartbeatService } from './heartbeat.service';
import { AcknowledgmentService } from './acknowledgment.service';
import { MessageQueueService } from './message-queue.service';

@Module({
  providers: [
    ControlChannelService,
    WebSocketClientService,
    CommandProcessorService,
    HeartbeatService,
    AcknowledgmentService,
    MessageQueueService,
  ],
  exports: [
    ControlChannelService,
    WebSocketClientService,
    CommandProcessorService,
  ],
})
export class ControlChannelModule {}