import { Controller, Get, Query } from '@nestjs/common';
import { EmployeeSyncService } from './employee-sync.service';
import { GetEmployeeSyncDto } from './get-employee-sync.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataScope, Role, Roles, Scope, User, UserContext } from '@app/shared/auth';

@ApiTags('Employee-sync')
@ApiBearerAuth()
@Controller('employee-sync')
export class EmployeeSyncController {
  constructor(private readonly service: EmployeeSyncService) { }

  @Get()
  @Roles(Role.ADMIN, Role.HR)

  async findAll(
    @Query() query: GetEmployeeSyncDto,
    @User() user: UserContext,
    @Scope() scope: DataScope,
  ) {
    return this.service.findAll(query,scope, user);
  }
}
