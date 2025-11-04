import { Injectable, Logger } from '@nestjs/common';
import { GatewayConfigService } from '../../config/gateway-config.service';
import { GatewayBufferService } from '../buffer/gateway-buffer.service';
import { BufferEnqueueItem } from '../buffer/interfaces';
import { CollectorBatchDto } from './dto/ingest-batch.dto';

@Injectable()
export class CollectorService {
    private readonly logger = new Logger(CollectorService.name);

    constructor(
        private readonly buffer: GatewayBufferService,
        private readonly config: GatewayConfigService
    ) {}

    async enqueueBatch(dto: CollectorBatchDto) {
        const items: BufferEnqueueItem[] = dto.records.map(record => ({
            type: record.type,
            occurredAt: record.occurredAt,
            payload: record.payload,
            source: record.source ?? dto.channel,
        }));

        const context = {
            gatewayId: dto.gatewayId ?? this.config.gatewayId,
            organizationId: this.config.organizationId,
            ...(dto.context ?? {}),
        };

        const bufferedRecords = await this.buffer.enqueueBatch(dto.channel, items, context);

        this.logger.debug(
            `Buffered ${bufferedRecords.length} record(s) for channel "${dto.channel}". Queue depth: ${this.buffer.size}`
        );

        return {
            accepted: bufferedRecords.length,
            queueDepth: this.buffer.size,
            recordIds: bufferedRecords.map(record => record.id),
        };
    }
}
