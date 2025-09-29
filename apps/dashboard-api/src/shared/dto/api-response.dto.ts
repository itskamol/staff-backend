import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ApiMetaDto {
    @ApiProperty({
        description: 'The number of items on the current page.',
        example: 10,
    })
    page: number;

    @ApiProperty({
        description: 'The total number of items available.',
        example: 100,
    })
    total: number;

    @ApiProperty({
        description: 'The number of items per page.',
        example: 10,
    })
    limit: number;
}

export class ApiSuccessResponse<T> {
    @ApiProperty({
        description: 'Indicates if the request was successful.',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'The main data payload of the response.',
    })
    data: T;

    constructor(data: T) {
        this.success = true;
        this.data = data;
    }
}

export class ApiPaginatedResponse<T> extends ApiSuccessResponse<T> {
    @ApiProperty({
        description: 'Optional metadata, typically used for pagination.',
        type: ApiMetaDto,
    })
    @Type(() => ApiMetaDto)
    meta: ApiMetaDto;

    constructor(data: T, meta: ApiMetaDto) {
        super(data);
        this.meta = meta;
    }
}

export class ApiErrorDto {
    @ApiProperty({
        description: 'A unique, machine-readable error code.',
        example: 'VALIDATION_ERROR',
    })
    code: string;

    @ApiProperty({
        description: 'A human-readable message providing details about the error.',
        example: 'Input validation failed',
    })
    message: string;

    @ApiProperty({
        description: 'An array of detailed error messages, often used for validation errors.',
        example: [
            {
                field: 'email',
                message: 'Email must be a valid email address.',
            },
        ],
        required: false,
    })
    details?: Record<string, any>;
}

export class ApiErrorResponse {
    @ApiProperty({
        description: 'Indicates if the request was successful.',
        example: false,
    })
    success: boolean;

    @ApiProperty({
        description: 'The detailed error information.',
        type: ApiErrorDto,
    })
    error: ApiErrorDto;

    @ApiProperty({
        description: 'The server timestamp when the error occurred.',
    })
    timestamp: string;

    constructor(error: ApiErrorDto) {
        this.success = false;
        this.error = error;
        this.timestamp = new Date().toISOString();
    }
}
