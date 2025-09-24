import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '@/shared/decorators';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiOkResponseData } from '@/shared/utils';
import { HealthCheckResponseDto } from './health/health.dto';

@ApiTags('App')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get a hello message' })
    @ApiResponse({ status: 200, description: 'Returns a hello message.' })
    getHello(): object {
        return this.appService.getHello();
    }

    @Get('health')
    @Public()
    @ApiOkResponseData(HealthCheckResponseDto, { 
        summary: 'Get the health status of the service' 
    })
    getHealth(): HealthCheckResponseDto {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'sector-staff-v2',
            version: '2.1.0',
        };
    }
}
