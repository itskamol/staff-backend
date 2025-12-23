import { IsString, IsInt, IsOptional, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class CreateJobDto {
    @ApiProperty({
        description: 'The value or description of the reason in Uzbek',
        minLength: 1,
        maxLength: 125,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(125)
    uz: string;

    @ApiProperty({
        description: 'The value or description of the reason in English',
        minLength: 1,
        maxLength: 125,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(125)
    eng: string;

    @ApiProperty({
        description: 'The value or description of the reason in Russian',
        minLength: 1,
        maxLength: 125,
    })
    @IsString()
    @MinLength(1)
    @MaxLength(125)
    ru: string;

    @ApiPropertyOptional({
        description: 'The Organization ID (taken from scope if not provided)',
        nullable: true,
    })
    @IsOptional()
    @IsInt()
    organizationId?: number;
}

export class UpdateJobDto extends PartialType(CreateJobDto) {}

export class JobResponseDto {
    @ApiProperty()
    id: number;

    @ApiProperty({
        description: 'The value or description of the reason in Uzbek',
        minLength: 1,
        maxLength: 125,
    })
    uz: string;

    @ApiProperty({
        description: 'The value or description of the reason in English',
        minLength: 1,
        maxLength: 125,
    })
    eng: string;

    @ApiProperty({
        description: 'The value or description of the reason in Russian',
        minLength: 1,
        maxLength: 125,
    })
    ru: string;

    @ApiProperty()
    organizationId: number;
}

export class JobQueryDto extends QueryDto {
    @ApiPropertyOptional({ description: 'Filter by Organization ID' })
    @Type(() => Number)
    @IsInt()
    @IsOptional()
    organizationId?: number;
}
