// ...existing code...
import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto, AttendanceQueryDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DataScope, Roles, Scope } from '@app/shared/auth';

@ApiTags('Attendance')
@Controller('attendances')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GUARD, Role.HR)
export class AttendanceController {
    constructor(private readonly service: AttendanceService) {}

    @Get()
    @ApiOperation({ summary: 'Get attendance records with filters' })
    @ApiResponse({ status: 200, description: 'List of attendance records' })
    async findAll(@Query() query: AttendanceQueryDto, @Scope() scope: DataScope) {
        return this.service.findAll(query, scope);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get attendance by id' })
    @ApiResponse({ status: 200, description: 'Attendance record' })
    async findById(@Param('id', ParseIntPipe) id: number, @Scope() scope: DataScope) {
        return this.service.findById(id, scope);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update attendance record' })
    @ApiResponse({ status: 200, description: 'Updated attendance record' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateAttendanceDto,
        @Scope() scope: DataScope
    ) {
        return this.service.update(id, dto, scope);
    }
}
