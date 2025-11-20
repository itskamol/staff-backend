import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceController } from './attendance.controller';
import { BullModule } from '@nestjs/bullmq';
import { JOB } from '../../shared/constants';
import { AttendanceProcessor } from '../queue/job/attandance.processor';
import { EmployeePlanModule } from '../employeePlan/employee-plan.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
    imports: [
        EmployeePlanModule,
        ScheduleModule.forRoot(),
        BullModule.registerQueue({ name: JOB.ATTENDANCE.NAME }),
    ],
    controllers: [AttendanceController],
    providers: [AttendanceService, AttendanceRepository, AttendanceProcessor],
    exports: [BullModule, AttendanceService],
})
export class AttendanceModule {}
