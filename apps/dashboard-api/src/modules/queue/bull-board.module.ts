import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Module } from '@nestjs/common';
import { JOB } from '../../shared/constants';

@Module({
    imports: [
        BullBoardModule.forFeature({
            name: JOB.DEVICE.NAME,
            adapter: BullMQAdapter,
        }),
    ],
})
export class QueueMonitorModule {}
