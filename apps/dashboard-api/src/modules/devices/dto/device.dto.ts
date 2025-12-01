import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsInt,
    IsEnum,
    IsIP,
    IsArray,
    ArrayNotEmpty,
    IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DeviceType, EntryType, WelcomePhoto, WelcomeText } from '@prisma/client';
import { Type } from 'class-transformer';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class CreateDeviceDto {
    @ApiProperty({ example: 'Main Entrance', description: 'Device name', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ example: 1, description: 'Gate ID', required: false })
    @IsOptional()
    @IsInt()
    gateId?: number;

    @ApiProperty({
        example: DeviceType.FACE,
        description: 'Device type',
        enum: DeviceType,
        required: false,
    })
    @IsOptional()
    @IsEnum(DeviceType)
    type?: DeviceType;

    @ApiProperty({ example: '192.168.1.100', description: 'Device IP address', required: false })
    @IsOptional()
    @IsIP()
    ipAddress?: string;

    @ApiProperty({ example: 'password123', description: 'Device password', required: false })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiProperty({
        example: EntryType.BOTH,
        description: 'Entry type',
        enum: EntryType,
        required: false,
    })
    @IsOptional()
    @IsEnum(EntryType)
    entryType?: EntryType;

    // @ApiProperty({ example: true, description: 'Device active status', required: false, default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;

    // @ApiProperty({ example: 'ACME Corp', description: 'Device manufacturer', required: false })
    @IsOptional()
    @IsString()
    manufacturer?: string;

    // @ApiProperty({ example: 'Model X', description: 'Device model', required: false })
    @IsOptional()
    @IsString()
    model?: string;

    // @ApiProperty({ example: '1.0.0', description: 'Device firmware version', required: false })
    @IsOptional()
    @IsString()
    firmware?: string;

    // @ApiProperty({ example: 'SN123456', description: 'Serial number', required: false })
    @IsOptional()
    @IsString()
    serialNumber?: string;

    @ApiProperty({ example: 'admin', description: 'Login', required: false })
    @IsOptional()
    @IsString()
    login?: string;

    @ApiProperty({ example: 'Welcome!', description: 'Welcome text', required: false })
    @IsOptional()
    @IsString()
    welcomeText?: string;

    @ApiProperty({
        example: WelcomeText.CUSTOM_TEXT,
        description: 'Welcome text type',
        enum: WelcomeText,
        required: false,
    })
    @IsOptional()
    @IsEnum(WelcomeText)
    welcomeTextType?: WelcomeText;

    @ApiProperty({
        example: '/images/welcome.png',
        description: 'Welcome photo URL',
        required: false,
    })
    @IsOptional()
    @IsString()
    welcomePhoto?: string;

    @ApiProperty({
        example: WelcomePhoto.CUSTOM_PHOTO,
        description: 'Welcome photo type',
        enum: WelcomePhoto,
        required: false,
    })
    @IsOptional()
    @IsEnum(WelcomePhoto)
    welcomePhotoType?: WelcomePhoto;
}

export class UpdateDeviceDto extends PartialType(CreateDeviceDto) {}

export class DeviceDto extends CreateDeviceDto {
    @ApiProperty({ example: 1, description: 'Device ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: 'online', description: 'Device status' })
    @IsString()
    status: string;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Last ping timestamp' })
    @IsString()
    lastPing: string;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: '2023-10-10T12:00:00Z', description: 'Last update timestamp' })
    @IsString()
    updatedAt: string;

    @ApiProperty({ example: 150, description: 'Total actions count', required: false })
    actionsCount?: number;

    @ApiProperty({ description: 'Gate information', required: false })
    gate?: {
        id: number;
        name: string;
    };
}

export class TestConnectionDto {
    @ApiProperty({
        example: 5,
        description: 'Connection timeout in seconds',
        required: false,
        default: 5,
    })
    @IsOptional()
    @IsInt()
    timeout?: number = 5;
}

export class AssignEmployeesToGatesDto {
    @ApiProperty({
        example: [1, 2, 3],
        description: 'Gate IDlar ro‘yxati',
        type: [Number],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    gateIds: number[];

    @ApiProperty({
        example: [5, 6, 7],
        description: 'Employee IDlar ro‘yxati',
        type: [Number],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    employeeIds: number[];

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsInt()
    organizationId?: number;
}

export class QueryDeviceDto extends QueryDto {
    @ApiPropertyOptional({ enum: DeviceType })
    @IsEnum(DeviceType)
    @IsOptional()
    type?: DeviceType;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    gateId?: number;

    @ApiPropertyOptional()
    @IsNumber()
    @IsOptional()
    @Type(() => Number)
    organizationId?: number;
}
