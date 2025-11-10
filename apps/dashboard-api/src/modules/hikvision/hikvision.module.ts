import { Module } from "@nestjs/common"
import { HikvisionService } from "./hikvision.service"
import { HikvisionController } from "./hikvision.controller"
import { HikvisionAuthService } from "./hikvision-auth.service"
import { EmployeeModule } from "../employee/employee.module"
import { GateModule } from "../gate/gate.module"
import { ActionModule } from "../action/action.module"
import { ConfigModule } from "../../core/config/config.module"
import { AttendanceModule } from "../attendance/attendance.module"

@Module({
  imports: [EmployeeModule, GateModule, ActionModule, ConfigModule, AttendanceModule],
  controllers: [HikvisionController],
  providers: [HikvisionService, HikvisionAuthService],
  exports: [HikvisionService, HikvisionAuthService],
})
export class HikvisionModule {}
