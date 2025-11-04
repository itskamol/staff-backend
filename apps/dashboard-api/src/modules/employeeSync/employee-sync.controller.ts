import { Controller, Get, Query } from '@nestjs/common';
import { EmployeeSyncService } from './employee-sync.service';
import { GetEmployeeSyncDto } from './get-employee-sync.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Employee-sync')
@ApiBearerAuth()
@Controller('employee-sync')
export class EmployeeSyncController {
  constructor(private readonly service: EmployeeSyncService) {}

  @Get()
  async findAll(@Query() query: GetEmployeeSyncDto) {
    return this.service.findAll(query);
  }
}
