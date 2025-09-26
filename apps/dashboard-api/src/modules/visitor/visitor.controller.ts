import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { VisitorService } from './visitor.service';
import { CreateVisitorDto, UpdateVisitorDto, GenerateCodeDto } from './dto/visitor.dto';

@ApiTags('Visitors')
@Controller('visitors')
export class VisitorController {
  constructor(private readonly visitorService: VisitorService) {}

  @Get()
  @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
  @ApiOperation({ summary: 'Get all visitors' })
  @ApiResponse({ status: 200, description: 'Visitors retrieved successfully' })
  async findAll(
    @Query() paginationDto: PaginationDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const result = await this.visitorService.findAll(paginationDto, user);
    return ApiResponseDto.success(result, 'Visitors retrieved successfully');
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
  @ApiOperation({ summary: 'Get visitor by ID' })
  @ApiResponse({ status: 200, description: 'Visitor retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Visitor not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const visitor = await this.visitorService.findOne(id, user);
    return ApiResponseDto.success(visitor, 'Visitor retrieved successfully');
  }

  @Post()
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Create new visitor' })
  @ApiResponse({ status: 201, description: 'Visitor created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async create(
    @Body() createVisitorDto: CreateVisitorDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const visitor = await this.visitorService.create(createVisitorDto, user);
    return ApiResponseDto.success(visitor, 'Visitor created successfully');
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Update visitor' })
  @ApiResponse({ status: 200, description: 'Visitor updated successfully' })
  @ApiResponse({ status: 404, description: 'Visitor not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateVisitorDto: UpdateVisitorDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const visitor = await this.visitorService.update(id, updateVisitorDto, user);
    return ApiResponseDto.success(visitor, 'Visitor updated successfully');
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Delete visitor' })
  @ApiResponse({ status: 200, description: 'Visitor deleted successfully' })
  @ApiResponse({ status: 404, description: 'Visitor not found' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    await this.visitorService.remove(id, user);
    return ApiResponseDto.success(null, 'Visitor deleted successfully');
  }

  @Post(':id/generate-code')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Generate onetime code for visitor' })
  @ApiResponse({ status: 200, description: 'Code generated successfully' })
  @ApiResponse({ status: 404, description: 'Visitor not found' })
  async generateCode(
    @Param('id', ParseIntPipe) id: number,
    @Body() generateCodeDto: GenerateCodeDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const code = await this.visitorService.generateCode(id, generateCodeDto, user);
    return ApiResponseDto.success(code, 'Code generated successfully');
  }

  @Get(':id/entry-logs')
  @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
  @ApiOperation({ summary: 'Get visitor entry logs' })
  @ApiResponse({ status: 200, description: 'Entry logs retrieved successfully' })
  async getEntryLogs(
    @Param('id', ParseIntPipe) id: number,
    @Query() paginationDto: PaginationDto,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const result = await this.visitorService.getEntryLogs(id, paginationDto, user);
    return ApiResponseDto.success(result, 'Entry logs retrieved successfully');
  }

  @Get('validate-code/:code')
  @Roles(Role.ADMIN, Role.HR, Role.DEPARTMENT_LEAD, Role.GUARD)
  @ApiOperation({ summary: 'Validate visitor code' })
  @ApiResponse({ status: 200, description: 'Code validated successfully' })
  @ApiResponse({ status: 404, description: 'Invalid or expired code' })
  async validateCode(
    @Param('code') code: string,
  ): Promise<ApiResponseDto> {
    const result = await this.visitorService.validateCode(code);
    return ApiResponseDto.success(result, 'Code validated successfully');
  }

  @Put('codes/:codeId/deactivate')
  @Roles(Role.ADMIN, Role.HR)
  @ApiOperation({ summary: 'Deactivate visitor code' })
  @ApiResponse({ status: 200, description: 'Code deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Code not found' })
  async deactivateCode(
    @Param('codeId', ParseIntPipe) codeId: number,
    @CurrentUser() user: any,
  ): Promise<ApiResponseDto> {
    const result = await this.visitorService.deactivateCode(codeId, user);
    return ApiResponseDto.success(result, 'Code deactivated successfully');
  }
}