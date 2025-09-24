import { Module } from '@nestjs/common';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';
import { EmployeeRepository } from './employee.repository';
import { PrismaModule } from '@/core/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [EmployeeController],
    providers: [EmployeeService, EmployeeRepository],
    exports: [EmployeeService, EmployeeRepository],
})
export class EmployeeModule {}