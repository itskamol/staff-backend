import { Module } from '@nestjs/common';
import { ActionService } from './service/action.service';
import { ActionRepository } from './repositories/action.repository';
import { ActionController } from './controller/action.controller';
import { AttendanceModule } from '../attendance/attendance.module';
import { OnetimeCodeModule } from '../onetime-codes/onetime-code.module';

@Module({
    imports: [AttendanceModule, OnetimeCodeModule],
    controllers: [ActionController],
    providers: [ActionService, ActionRepository],
    exports: [ActionService],
})
export class ActionModule {}
