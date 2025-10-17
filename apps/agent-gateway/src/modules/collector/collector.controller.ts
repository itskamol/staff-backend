import { Body, Controller, Post } from '@nestjs/common';
import { CollectorService } from './collector.service';
import { CollectorBatchDto } from './dto/ingest-batch.dto';

@Controller('collector')
export class CollectorController {
    constructor(private readonly collectorService: CollectorService) {}

    @Post('batch')
    async ingestBatch(@Body() dto: CollectorBatchDto) {
        return this.collectorService.enqueueBatch(dto);
    }
}
