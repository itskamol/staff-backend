import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DepartmentRepository } from './department.repository';

@Module({
    imports: [],
    controllers: [DepartmentController],
    providers: [DepartmentService, DepartmentRepository],
    exports: [DepartmentService],
})
export class DepartmentModule {}
