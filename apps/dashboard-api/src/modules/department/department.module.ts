import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@staff-control-system/shared/database';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}