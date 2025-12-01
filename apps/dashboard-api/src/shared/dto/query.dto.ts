import { IsBoolean, IsEmpty, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class QueryDto extends PaginationDto {
    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'Search term (at least 2 characters)',
        minLength: 2,
        required: false,
    })
    search?: string;

    @ApiProperty({
        description: 'Filter by active status',
        type: Boolean,
        required: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    isActive?: boolean;

    @ApiProperty({
        description: 'Filter by delete status',
        type: Boolean,
        required: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    isDeleted?: boolean;

    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'Sort by field',
        example: 'name',
        required: false,
    })
    sort?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'Sort order',
        example: 'asc',
        required: false,
    })
    order?: 'asc' | 'desc';

    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'Start date',
        required: false,
    })
    startDate?: string;

    @IsString()
    @IsOptional()
    @ApiProperty({
        required: false,
        description: 'End date',
    })
    endDate?: string;
}
