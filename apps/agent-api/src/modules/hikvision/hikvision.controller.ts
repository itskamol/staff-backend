import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ApiKeyGuard, ApiKeyTypes } from '../security/guards/api-key.guard';
import { ApiKeyType } from '../security/dto/security.dto';
import { HIKVisionService } from './hikvision.service';
import {
    HIKVisionActionDto,
    HIKVisionEventDto,
    HIKVisionDeviceStatusDto,
    HIKVisionBatchActionDto,
    HIKVisionBatchEventDto,
    HIKVisionBatchDeviceStatusDto,
} from './dto/hikvision.dto';

@ApiTags('HIKVision Integration')
@Controller('hikvision')
@UseGuards(ApiKeyGuard)
@ApiKeyTypes(ApiKeyType.HIKVISION, ApiKeyType.ADMIN)
@ApiBearerAuth()
export class HIKVisionController {
    constructor(private readonly hikVisionService: HIKVisionService) {}

    @Post('actions')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Process HIKVision access control action',
        description:
            'Receives and processes access control actions from HIKVision devices (face recognition, card swipe, etc.)',
    })
    @ApiResponse({
        status: 200,
        description: 'Action processed successfully',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                processed: { type: 'boolean' },
                deviceMatched: { type: 'boolean' },
                personMatched: { type: 'boolean' },
                actionRecorded: { type: 'boolean' },
                errors: { type: 'array', items: { type: 'string' } },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid action data' })
    async processAction(@Body() actionDto: HIKVisionActionDto) {
        return this.hikVisionService.processAction(actionDto);
    }

    @Post('actions/batch')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Process batch of HIKVision actions',
        description:
            'Processes multiple access control actions in a single request for better performance',
    })
    @ApiResponse({
        status: 200,
        description: 'Batch actions processed successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    processed: { type: 'boolean' },
                    deviceMatched: { type: 'boolean' },
                    personMatched: { type: 'boolean' },
                    actionRecorded: { type: 'boolean' },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid batch data' })
    async processBatchActions(@Body() batchDto: HIKVisionBatchActionDto) {
        return this.hikVisionService.processBatchActions(batchDto);
    }

    @Post('events')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Process HIKVision system events',
        description:
            'Receives and processes system events from HIKVision devices (alarms, door status, etc.)',
    })
    @ApiResponse({
        status: 200,
        description: 'Event processed successfully',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                processed: { type: 'boolean' },
                alertGenerated: { type: 'boolean' },
                notificationSent: { type: 'boolean' },
                errors: { type: 'array', items: { type: 'string' } },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid event data' })
    async processEvent(@Body() eventDto: HIKVisionEventDto) {
        return this.hikVisionService.processEvent(eventDto);
    }

    @Post('events/batch')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Process batch of HIKVision events',
        description: 'Processes multiple system events in a single request',
    })
    @ApiResponse({
        status: 200,
        description: 'Batch events processed successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    id: { type: 'string' },
                    processed: { type: 'boolean' },
                    alertGenerated: { type: 'boolean' },
                    notificationSent: { type: 'boolean' },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid batch event data' })
    async processBatchEvents(@Body() batchDto: HIKVisionBatchEventDto) {
        return this.hikVisionService.processBatchEvents(batchDto);
    }

    @Post('device-status')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update HIKVision device status',
        description:
            'Receives device status updates including health metrics, connectivity status, etc.',
    })
    @ApiResponse({
        status: 200,
        description: 'Device status updated successfully',
        schema: {
            type: 'object',
            properties: {
                deviceIp: { type: 'string' },
                statusUpdated: { type: 'boolean' },
                alertsGenerated: { type: 'number' },
                errors: { type: 'array', items: { type: 'string' } },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid device status data' })
    async updateDeviceStatus(@Body() statusDto: HIKVisionDeviceStatusDto) {
        return this.hikVisionService.processDeviceStatus(statusDto);
    }

    @Post('device-status/batch')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update batch of HIKVision device statuses',
        description: 'Updates multiple device statuses in a single request',
    })
    @ApiResponse({
        status: 200,
        description: 'Batch device statuses updated successfully',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    deviceIp: { type: 'string' },
                    statusUpdated: { type: 'boolean' },
                    alertsGenerated: { type: 'number' },
                    errors: { type: 'array', items: { type: 'string' } },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid batch device status data' })
    async updateBatchDeviceStatus(@Body() batchDto: HIKVisionBatchDeviceStatusDto) {
        return this.hikVisionService.processBatchDeviceStatus(batchDto);
    }

    @Post('heartbeat')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'HIKVision device heartbeat',
        description: 'Simple heartbeat endpoint for HIKVision devices to report they are online',
    })
    @ApiResponse({
        status: 200,
        description: 'Heartbeat received',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'ok' },
                timestamp: { type: 'string', format: 'date-time' },
                message: { type: 'string' },
            },
        },
    })
    async heartbeat(@Body() data: { deviceIp: string; deviceSerial: string; timestamp: string }) {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            message: `Heartbeat received from device ${data.deviceIp}`,
        };
    }
}
