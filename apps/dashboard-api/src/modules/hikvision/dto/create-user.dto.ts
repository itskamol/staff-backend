// dto/create-user.dto.ts
import { IsString, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RightPlanDto {
  @ApiProperty({ example: 1 })
  doorNo: number;

  @ApiProperty({ example: '1' })
  planTemplateNo: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'EMP123' })
  @IsString()
  employeeNo: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsString()
  lastName?: string;

  @ApiProperty({ example: '2025-01-01T00:00:00Z' })
  @IsDateString()
  beginTime: string;

  @ApiProperty({ example: '2026-01-01T00:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiProperty({ type: [RightPlanDto] })
  rightPlans: RightPlanDto[];

  @ApiProperty({ example: '1' })
  @IsString()
  doorRight: string;
}
