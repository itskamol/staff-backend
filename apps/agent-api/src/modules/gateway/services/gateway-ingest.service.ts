import { Injectable, Logger } from '@nestjs/common';
import { GatewayIngestBatchDto } from '../dto/gateway-ingest.dto';
import { GatewayIngestBatchResponse } from '@app/shared/gateway';

@Injectable()
export class GatewayIngestService {
    private readonly logger = new Logger(GatewayIngestService.name);

    async handleBatch(dto: GatewayIngestBatchDto): Promise<GatewayIngestBatchResponse> {
        const accepted = dto.records.length;
        const processedAt = new Date().toISOString();

        this.logger.debug(
            `Received gateway batch from ${dto.gatewayId} with ${accepted} record(s)`
        );

        // TODO: Persist records and dispatch to processing pipeline.

        return {
            accepted,
            processedAt,
            message: 'Batch accepted',
            queueDepth: 0,
        };
    }
}
