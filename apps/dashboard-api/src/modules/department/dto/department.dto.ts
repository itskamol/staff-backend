import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  organizationId: number;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  parentId?: number;

  @ApiProperty({ example: 'Axborot texnologiyalari departamenti' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'ATD' })
  @IsString()
  @IsNotEmpty()
  shortName: string;

  @ApiProperty({ example: 'Toshkent sh., Chilonzor tumani', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '+998712391240', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'it@company.uz', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'IT va dasturiy ta\'minot', required: false })
  @IsOptional()
  @IsString()
  additionalDetails?: string;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  organizationId?: number;
}