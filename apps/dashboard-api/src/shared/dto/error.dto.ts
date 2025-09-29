import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
    @ApiProperty({
        example: 400,
        description: 'The HTTP status code.',
    })
    statusCode: number;

    @ApiProperty({
        example: 'Validation failed',
        description: 'A human-readable message describing the error.',
    })
    message: string | string[];

    @ApiProperty({
        example: 'Bad Request',
        description: 'A short description of the HTTP error.',
    })
    error: string;

    @ApiProperty({
        example: '2023-08-14T10:00:00.000Z',
        description: 'The timestamp of when the error occurred.',
    })
    timestamp: string;

    @ApiProperty({
        example: '/api/v1/users',
        description: 'The path of the request that caused the error.',
    })
    path: string;
}
