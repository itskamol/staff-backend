import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '@/shared/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DetailedHealthCheckResponseDto, HealthCheckResponseDto } from './health.dto';
import { plainToClass } from 'class-transformer';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get the health status of the service' })
    @ApiResponse({
        status: 200,
        description: 'The health status of the service.',
        type: HealthCheckResponseDto,
    })
    async getHealth(): Promise<HealthCheckResponseDto> {
        return this.healthService.getHealthStatus();
    }

    @Get('detailed')
    @Public()
    @ApiOperation({ summary: 'Get a detailed health status of the service and its dependencies' })
    @ApiResponse({
        status: 200,
        description: 'The detailed health status of the service.',
        type: DetailedHealthCheckResponseDto,
    })
    async getDetailedHealth(): Promise<DetailedHealthCheckResponseDto> {
        const result = await this.healthService.getDetailedHealthStatus();
        return plainToClass(DetailedHealthCheckResponseDto, result);
    }
}
