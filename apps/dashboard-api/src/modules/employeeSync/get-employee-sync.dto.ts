import { IsOptional, IsString, IsNumber, IsIn, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import {  ApiPropertyOptional } from '@nestjs/swagger';
import { StatusEnum } from '@prisma/client';

export class GetEmployeeSyncDto {

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  gateId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  employeeId?: number;

  @ApiPropertyOptional({ enum: StatusEnum, description: 'Status filter' })
  @IsOptional()
  @IsEnum(StatusEnum)
  status?: StatusEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc';
}
