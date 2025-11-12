import { Module } from "@nestjs/common"
import { HikvisionService } from "./hikvision.service"
import { HikvisionController } from "./hikvision.controller"
import { HikvisionAuthService } from "./hikvision-auth.service"
import { GateModule } from "../gate/gate.module"
import { ActionModule } from "../action/action.module"
import { AttendanceModule } from "../attendance/attendance.module"
import { EmployeeRepository } from "../employee/repositories/employee.repository"

@Module({
  imports: [ GateModule, ActionModule, AttendanceModule],
  controllers: [HikvisionController],
  providers: [HikvisionService, HikvisionAuthService, EmployeeRepository],
  exports: [HikvisionService, HikvisionAuthService],
})
export class HikvisionModule {}
