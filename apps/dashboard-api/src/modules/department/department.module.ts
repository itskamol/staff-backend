import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';
import { BullModule } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';

@Module({
    imports: [BullModule.registerQueue({ name: JOB.DEVICE.NAME })],
    controllers: [DepartmentController],
    providers: [DepartmentService, DepartmentRepository],
    exports: [DepartmentService],
})
export class DepartmentModule {}
