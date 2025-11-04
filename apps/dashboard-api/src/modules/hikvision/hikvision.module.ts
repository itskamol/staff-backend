import { Module } from "@nestjs/common"
import { HikvisionService } from "./hikvision.service"
import { HikvisionController } from "./hikvision.controller"
import { HikvisionAuthService } from "./hikvision-auth.service"
import { EmployeeModule } from "../employee/employee.module"

@Module({
  imports: [EmployeeModule],
  controllers: [HikvisionController],
  providers: [HikvisionService, HikvisionAuthService],
  exports: [HikvisionService, HikvisionAuthService],
})
export class HikvisionModule {}
