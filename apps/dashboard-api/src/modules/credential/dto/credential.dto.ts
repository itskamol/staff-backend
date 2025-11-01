import { IsString, IsInt, IsBoolean, IsOptional, IsEnum, MinLength, MaxLength, IsNumber, Min, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActionType } from '@prisma/client';

export class CreateCredentialDto {
    @ApiProperty({ description: 'The ID of the employee this credential belongs to' })
    @Type(() => Number)
    @IsInt()
    employeeId: number;

    @ApiProperty({ description: 'The unique code associated with the credential (e.g., card number, license plate)', minLength: 1, maxLength: 50 })
    @IsString()
    @MinLength(1)
    @MaxLength(50)
    code: string;

    @ApiProperty({ enum: ActionType, description: 'The type of credential being created' })
    @IsEnum(ActionType)
    type: ActionType;

    @ApiPropertyOptional({ description: 'Additional descriptive details about the credential', nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    additionalDetails?: string;

    @ApiPropertyOptional({ description: 'Whether the credential is currently active', default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateCredentialDto extends CreateCredentialDto {
}

export class CredentialResponseDto {
    @ApiProperty()
    id: number;
    
    @ApiProperty()
    code: string;
    
    @ApiProperty({ enum: ActionType })
    type: ActionType;

    @ApiProperty()
    employeeId: number;
    
    @ApiProperty()
    isActive: boolean;
    
    @ApiProperty()
    createdAt: Date;
    
    @ApiProperty()
    updatedAt: Date;
}

export class CredentialQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdAt' })
  @IsString()
  @IsOptional()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ description: 'Sort order', default: 'desc' })
  @IsString()
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ActionType, description: 'Filter by Action Type' })
  @IsEnum(ActionType)
  @IsOptional()
  type?: ActionType;

  @ApiPropertyOptional({ description: 'Filter by Employee ID' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  employeeId?: number;

  @ApiPropertyOptional({ description: 'Filter by Department ID' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @ApiPropertyOptional({ description: 'Filter by Organization ID' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  organizationId?: number;
}
