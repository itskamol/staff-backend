import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class PaginationDto {
    @ApiProperty({
        description: 'The page number to retrieve.',
        example: 1,
        default: 1,
        required: false,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiProperty({
        description: 'The number of items to retrieve per page.',
        example: 10,
        default: 10,
        required: false,
    })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 10;
}

export class PaginationResponseDto<T> {
    @ApiProperty({
        description: 'The data for the current page.',
        isArray: true,
    })
    data: T[];

    @ApiProperty({
        description: 'The total number of items.',
        example: 100,
    })
    total?: number;

    @ApiProperty({
        description: 'The current page number.',
        example: 1,
    })
    page?: number;

    @ApiProperty({
        description: 'The number of items per page.',
        example: 10,
    })
    limit: number;

    @ApiProperty({
        description: 'The total number of pages.',
        example: 10,
    })
    totalPages?: number;

    constructor(data: T[], total: number, page: number, limit: number) {
        this.data = data;
        this.total = total;
        this.page = page;
        this.limit = limit;
        this.totalPages = Math.ceil(total / limit);
    }
}
