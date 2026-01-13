import { IsOptional, IsString, IsNumber, IsIn, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { StatusEnum, VisitorType } from '@prisma/client';
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
    deviceId?: number;

    @ApiPropertyOptional({
        enum: VisitorType,
        description: 'EMPLOYEE yoki VISITOR',
    })
    @IsOptional()
    @IsEnum(VisitorType)
    userType?: VisitorType;

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
