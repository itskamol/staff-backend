import { IsOptional, IsString, IsNumber, IsIn, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusEnum } from '@prisma/client';
import { QueryDto } from '../../shared/dto';

export class GetEmployeeSyncDto extends QueryDto {
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

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    credentialId?: number;

    @ApiPropertyOptional({ enum: StatusEnum, description: 'Status filter' })
    @IsOptional()
    @IsEnum(StatusEnum)
    status?: StatusEnum;
}
