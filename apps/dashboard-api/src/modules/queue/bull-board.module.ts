import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Module } from '@nestjs/common';
import { JOB } from '../../shared/constants';
import { EmployeePlanModule } from '../employeePlan/employee-plan.module';

@Module({
    imports: [
        EmployeePlanModule,
        BullBoardModule.forFeature({
            name: JOB.DEVICE.NAME,
            adapter: BullMQAdapter,
        }),
        BullBoardModule.forFeature({
            name: JOB.ATTENDANCE.NAME,
            adapter: BullMQAdapter,
        }),
    ],
})
export class QueueMonitorModule {}
