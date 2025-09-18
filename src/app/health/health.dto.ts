import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckResponseDto {
    @ApiProperty({
        description: 'The status of the service.',
        example: 'ok',
    })
    status: string;

    @ApiProperty({
        description: 'The timestamp of the health check.',
        example: '2023-08-14T10:00:00.000Z',
    })
    timestamp: string;

    @ApiProperty({
        description: 'The name of the service.',
        example: 'sector-staff-v2',
    })
    service: string;

    @ApiProperty({
        description: 'The version of the service.',
        example: '2.1.0',
    })
    version: string;
}

class HealthCheckDependencyDto {
    @ApiProperty({
        description: 'The name of the dependency.',
        example: 'database',
    })
    name: string;

    @ApiProperty({
        description: 'The status of the dependency.',
        example: 'ok',
    })
    status: string;
}

export class DetailedHealthCheckResponseDto extends HealthCheckResponseDto {
    @ApiProperty({
        description: 'A list of dependencies and their health status.',
        type: [HealthCheckDependencyDto],
    })
    dependencies: HealthCheckDependencyDto[];
}
