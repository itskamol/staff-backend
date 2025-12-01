import { IsString, IsInt, IsOptional, MaxLength, MinLength, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class CreateReasonDto {
    @ApiProperty({
        description: 'The value or description of the reason',
        minLength: 1,
        maxLength: 255,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    value: string;

    @ApiPropertyOptional({
        description: 'The Organization ID (taken from scope if not provided)',
        nullable: true,
    })
    @IsOptional()
    @IsInt()
    organizationId?: number;
}

export class UpdateReasonDto extends PartialType(CreateReasonDto) {}

export class ReasonResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty()
    value: string;

    @ApiProperty()
    organizationId: number;
}

export class ReasonQueryDto extends QueryDto {
    @ApiPropertyOptional({ description: 'Filter by Organization ID' })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    organizationId?: number;
}
