import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '@/shared/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiOkResponseData } from '@/shared/utils';
import { DetailedHealthCheckResponseDto, HealthCheckResponseDto } from './health.dto';
import { plainToClass } from 'class-transformer';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) {}

    @Get()
    @Public()
    @ApiOkResponseData(HealthCheckResponseDto, { 
        summary: 'Get the health status of the service' 
    })
    async getHealth(): Promise<HealthCheckResponseDto> {
        return this.healthService.getHealthStatus();
    }

    @Get('detailed')
    @Public()
    @ApiOkResponseData(DetailedHealthCheckResponseDto, { 
        summary: 'Get a detailed health status of the service and its dependencies' 
    })
    async getDetailedHealth(): Promise<DetailedHealthCheckResponseDto> {
        const result = await this.healthService.getDetailedHealthStatus();
        return plainToClass(DetailedHealthCheckResponseDto, result);
    }
}
