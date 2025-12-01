import { Controller, Get, Put, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ActionService } from '../service/action.service';
import { ActionQueryDto, UpdateActionDto } from '../dto/action.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DataScope, Role, Roles, Scope } from '@app/shared/auth';

@ApiTags('Actions')
@ApiBearerAuth()
@Controller('action')
@Roles(Role.ADMIN, Role.GUARD, Role.HR)
export class ActionController {
    constructor(private readonly service: ActionService) {}

    @Get()
    async findAll(@Query() dto?: ActionQueryDto, @Scope() scope?: DataScope) {
        return this.service.findAll(dto, scope);
    }

    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number, @Scope() scope?: DataScope) {
        return this.service.findOne(id, scope);
    }
}
