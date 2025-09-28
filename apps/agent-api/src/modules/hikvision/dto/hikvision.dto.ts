import {
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
    IsNumber,
    IsObject,
    IsArray,
    ValidateNested,
    IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum HIKVisionActionType {
    FACE_RECOGNITION = 'FACE_RECOGNITION',
    CARD_SWIPE = 'CARD_SWIPE',
    FINGERPRINT = 'FINGERPRINT',
    PASSWORD = 'PASSWORD',
    QR_CODE = 'QR_CODE',
    REMOTE_OPEN = 'REMOTE_OPEN',
}

export enum HIKVisionEventType {
    ACCESS_GRANTED = 'ACCESS_GRANTED',
    ACCESS_DENIED = 'ACCESS_DENIED',
    DOOR_OPENED = 'DOOR_OPENED',
    DOOR_CLOSED = 'DOOR_CLOSED',
    ALARM_TRIGGERED = 'ALARM_TRIGGERED',
    DEVICE_ONLINE = 'DEVICE_ONLINE',
    DEVICE_OFFLINE = 'DEVICE_OFFLINE',
    TAMPER_DETECTED = 'TAMPER_DETECTED',
}

export enum HIKVisionDeviceStatus {
    ONLINE = 'ONLINE',
    OFFLINE = 'OFFLINE',
    ERROR = 'ERROR',
    MAINTENANCE = 'MAINTENANCE',
}

export class HIKVisionPersonInfo {
    @ApiPropertyOptional({ description: 'Person ID in HIKVision system' })
    @IsOptional()
    @IsString()
    personId?: string;

    @ApiPropertyOptional({ description: 'Person name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Employee ID' })
    @IsOptional()
    @IsString()
    employeeId?: string;

    @ApiPropertyOptional({ description: 'Card number' })
    @IsOptional()
    @IsString()
    cardNumber?: string;

    @ApiPropertyOptional({ description: 'Face template ID' })
    @IsOptional()
    @IsString()
    faceTemplateId?: string;
}

export class HIKVisionActionDto {
    @ApiProperty({ description: 'Device IP address' })
    @IsString()
    deviceIp: string;

    @ApiProperty({ description: 'Device serial number' })
    @IsString()
    deviceSerial: string;

    @ApiProperty({
        description: 'Action type',
        enum: HIKVisionActionType,
        example: HIKVisionActionType.FACE_RECOGNITION,
    })
    @IsEnum(HIKVisionActionType)
    actionType: HIKVisionActionType;

    @ApiProperty({
        description: 'Action timestamp',
        example: '2024-01-15T09:30:00Z',
    })
    @IsDateString()
    timestamp: string;

    @ApiProperty({ description: 'Whether access was granted' })
    @IsBoolean()
    accessGranted: boolean;

    @ApiPropertyOptional({ description: 'Person information' })
    @IsOptional()
    @ValidateNested()
    @Type(() => HIKVisionPersonInfo)
    personInfo?: HIKVisionPersonInfo;

    @ApiPropertyOptional({ description: 'Door/gate number' })
    @IsOptional()
    @IsNumber()
    doorNumber?: number;

    @ApiPropertyOptional({ description: 'Additional event data' })
    @IsOptional()
    @IsObject()
    eventData?: any;

    @ApiPropertyOptional({ description: 'Photo/image data (base64)' })
    @IsOptional()
    @IsString()
    photoData?: string;

    @ApiPropertyOptional({ description: 'Error message if access denied' })
    @IsOptional()
    @IsString()
    errorMessage?: string;
}

export class HIKVisionEventDto {
    @ApiProperty({ description: 'Device IP address' })
    @IsString()
    deviceIp: string;

    @ApiProperty({ description: 'Device serial number' })
    @IsString()
    deviceSerial: string;

    @ApiProperty({
        description: 'Event type',
        enum: HIKVisionEventType,
        example: HIKVisionEventType.DOOR_OPENED,
    })
    @IsEnum(HIKVisionEventType)
    eventType: HIKVisionEventType;

    @ApiProperty({
        description: 'Event timestamp',
        example: '2024-01-15T09:30:00Z',
    })
    @IsDateString()
    timestamp: string;

    @ApiPropertyOptional({ description: 'Event description' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ description: 'Door/gate number' })
    @IsOptional()
    @IsNumber()
    doorNumber?: number;

    @ApiPropertyOptional({ description: 'Event severity level (1-5)' })
    @IsOptional()
    @IsNumber()
    severity?: number;

    @ApiPropertyOptional({ description: 'Additional event parameters' })
    @IsOptional()
    @IsObject()
    parameters?: any;

    @ApiPropertyOptional({ description: 'Related person information' })
    @IsOptional()
    @ValidateNested()
    @Type(() => HIKVisionPersonInfo)
    personInfo?: HIKVisionPersonInfo;
}

export class HIKVisionDeviceStatusDto {
    @ApiProperty({ description: 'Device IP address' })
    @IsString()
    deviceIp: string;

    @ApiProperty({ description: 'Device serial number' })
    @IsString()
    deviceSerial: string;

    @ApiProperty({
        description: 'Device status',
        enum: HIKVisionDeviceStatus,
        example: HIKVisionDeviceStatus.ONLINE,
    })
    @IsEnum(HIKVisionDeviceStatus)
    status: HIKVisionDeviceStatus;

    @ApiProperty({
        description: 'Status timestamp',
        example: '2024-01-15T09:30:00Z',
    })
    @IsDateString()
    timestamp: string;

    @ApiPropertyOptional({ description: 'Device name/location' })
    @IsOptional()
    @IsString()
    deviceName?: string;

    @ApiPropertyOptional({ description: 'Device model' })
    @IsOptional()
    @IsString()
    deviceModel?: string;

    @ApiPropertyOptional({ description: 'Firmware version' })
    @IsOptional()
    @IsString()
    firmwareVersion?: string;

    @ApiPropertyOptional({ description: 'CPU usage percentage' })
    @IsOptional()
    @IsNumber()
    cpuUsage?: number;

    @ApiPropertyOptional({ description: 'Memory usage percentage' })
    @IsOptional()
    @IsNumber()
    memoryUsage?: number;

    @ApiPropertyOptional({ description: 'Storage usage percentage' })
    @IsOptional()
    @IsNumber()
    storageUsage?: number;

    @ApiPropertyOptional({ description: 'Network status information' })
    @IsOptional()
    @IsObject()
    networkInfo?: {
        connected: boolean;
        signalStrength?: number;
        bandwidth?: number;
    };

    @ApiPropertyOptional({ description: 'Error messages if status is ERROR' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    errorMessages?: string[];

    @ApiPropertyOptional({ description: 'Last maintenance date' })
    @IsOptional()
    @IsDateString()
    lastMaintenanceDate?: string;
}

export class HIKVisionBatchActionDto {
    @ApiProperty({
        description: 'Array of HIKVision actions',
        type: [HIKVisionActionDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HIKVisionActionDto)
    actions: HIKVisionActionDto[];
}

export class HIKVisionBatchEventDto {
    @ApiProperty({
        description: 'Array of HIKVision events',
        type: [HIKVisionEventDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HIKVisionEventDto)
    events: HIKVisionEventDto[];
}

export class HIKVisionBatchDeviceStatusDto {
    @ApiProperty({
        description: 'Array of device status updates',
        type: [HIKVisionDeviceStatusDto],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HIKVisionDeviceStatusDto)
    devices: HIKVisionDeviceStatusDto[];
}

// Response DTOs
export interface HIKVisionActionResponse {
    id: string;
    processed: boolean;
    deviceMatched: boolean;
    personMatched: boolean;
    actionRecorded: boolean;
    errors?: string[];
}

export interface HIKVisionEventResponse {
    id: string;
    processed: boolean;
    alertGenerated: boolean;
    notificationSent: boolean;
    errors?: string[];
}

export interface HIKVisionDeviceStatusResponse {
    deviceIp: string;
    statusUpdated: boolean;
    alertsGenerated: number;
    errors?: string[];
}
