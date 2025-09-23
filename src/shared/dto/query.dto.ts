import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from './pagination.dto';
import { ApiProperty } from '@nestjs/swagger';

export class QueryDto extends PaginationDto {
    @IsString()
    @IsOptional()
    @ApiProperty({
        description: 'Search term (at least 2 characters)',
        example: 'search term',
        minLength: 2,
        required: false,
    })
    search?: string;

    @IsOptional()
    @IsBoolean()
    @ApiProperty({
        description: 'Filter by active status',
        example: true,
        required: false,
    })
    isActive?: boolean;

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
}
