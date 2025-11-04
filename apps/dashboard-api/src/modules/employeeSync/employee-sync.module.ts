import { Module } from '@nestjs/common';
import { EmployeeSyncService } from './employee-sync.service';
import { EmployeeSyncController } from './employee-sync.controller';

@Module({
controllers: [EmployeeSyncController],
providers: [EmployeeSyncService],
})
export class EmployeeSyncModule {}