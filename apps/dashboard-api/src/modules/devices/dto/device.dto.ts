import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsEnum, IsIP } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { DeviceType, EntryType } from '@prisma/client';

export class CreateDeviceDto {
    @ApiProperty({ 
        example: 'Main Entrance',
        description: 'Device name'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ 
        example: 'HIKVISION',
        description: 'Device type',
        enum: DeviceType
    })
    @IsEnum(DeviceType)
    type: DeviceType;

    @ApiProperty({ 
        example: '192.168.1.100',
        description: 'Device IP address'
    })
    @IsIP()
    @IsNotEmpty()
    ip_address: string;

    @ApiProperty({ 
        example: 8000,
        description: 'Device port',
        required: false,
        default: 8000
    })
    @IsOptional()
    @IsInt()
    port?: number = 8000;

    @ApiProperty({ 
        example: 'admin',
        description: 'Device username'
    })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ 
        example: 'password123',
        description: 'Device password'
    })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiProperty({ 
        example: 'both',
        description: 'Entry type',
        enum: EntryType
    })
    @IsEnum(EntryType)
    entry_type: EntryType;

    @ApiProperty({ 
        example: 'Main building entrance device',
        description: 'Additional details',
        required: false
    })
    @IsOptional()
    @IsString()
    additional_details?: string;

    @ApiProperty({ 
        example: true,
        description: 'Device active status',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean = true;
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
    last_ping: string;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: '2023-10-10T12:00:00Z', description: 'Last update timestamp' })
    @IsString()
    updatedAt: string;

    @ApiProperty({ example: 150, description: 'Total actions count', required: false })
    actionsCount?: number;
}

export class TestConnectionDto {
    @ApiProperty({ 
        example: 5,
        description: 'Connection timeout in seconds',
        required: false,
        default: 5
    })
    @IsOptional()
    @IsInt()
    timeout?: number = 5;
}