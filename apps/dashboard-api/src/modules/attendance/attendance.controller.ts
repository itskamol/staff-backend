import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import {AttendanceQueryDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Attendance')
@Controller('attendances')
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  @Get()
  @ApiOperation({ summary: 'Get attendance records with filters' })
  @ApiResponse({ status: 200, description: 'List of attendance records' })
  async findAll(@Query() query: AttendanceQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance by id' })
  @ApiResponse({ status: 200, description: 'Attendance record' })
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update attendance record' })
  @ApiResponse({ status: 200, description: 'Updated attendance record' })
  async update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete attendance record' })
  @ApiResponse({ status: 200, description: 'Attendance deleted' })
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}