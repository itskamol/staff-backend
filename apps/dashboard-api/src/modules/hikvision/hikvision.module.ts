import { Module } from "@nestjs/common"
import { HikvisionService } from "./hikvision.service"
import { HikvisionController } from "./hikvision.controller"
import { GateModule } from "../gate/gate.module"
import { ActionModule } from "../action/action.module"
import { AttendanceModule } from "../attendance/attendance.module"
import { EmployeeRepository } from "../employee/repositories/employee.repository"
import { XmlJsonService } from "../../shared/services/xtml-json.service"
import { EncryptionService } from "../../shared/services/encryption.service"

@Module({
  imports: [ GateModule, ActionModule, AttendanceModule],
  controllers: [HikvisionController],
  providers: [HikvisionService, EmployeeRepository, XmlJsonService, EncryptionService],
  exports: [HikvisionService],
})
export class HikvisionModule {}
