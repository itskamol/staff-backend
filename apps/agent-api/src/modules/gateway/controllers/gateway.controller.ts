import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GatewayIngestBatchDto } from '../dto/gateway-ingest.dto';
import { GatewayIngestService } from '../services/gateway-ingest.service';
import { GatewayApiKeyGuard } from '../guards/gateway-api-key.guard';

@Controller('gateway')
export class GatewayController {
    constructor(private readonly ingestService: GatewayIngestService) {}

    @Post('ingest')
    @UseGuards(GatewayApiKeyGuard)
    ingestBatch(@Body() dto: GatewayIngestBatchDto) {
        return this.ingestService.handleBatch(dto);
    }
}
