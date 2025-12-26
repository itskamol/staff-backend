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
import { ActionType, EntryType, WelcomePhoto, WelcomeText } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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
        example: [ActionType.PHOTO, ActionType.CARD],
        description: 'Device Types',
        enum: ActionType,
        isArray: true,
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsEnum(ActionType, { each: true })
    deviceTypes?: ActionType[];

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

export class ConnectionDto {
    @ApiProperty({
        example: [1, 2, 3],
        description: 'Device IDlari ro‘yxati',
        type: [Number],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    deviceIds: number[];

    @ApiProperty({
        example: 1,
        description: 'Gate ID (Bitta darvoza IDsi)',
        type: Number,
    })
    @IsInt()
    gateId: number; //
}

export class AssignEmployeesToGatesDto {
    @ApiProperty({
        example: 1,
        description: 'Gate ID (Bitta darvoza IDsi)',
        type: Number,
    })
    @IsInt()
    gateId: number; // Nomini gateIds dan gateId ga o'zgartirdik (chunki u bitta son)

    @ApiProperty({
        example: [5, 6, 7],
        description: 'Xodimlar IDlari ro‘yxati',
        type: [Number],
    })
    @IsArray()
    @ArrayNotEmpty()
    @IsInt({ each: true })
    employeeIds: number[];

    @ApiProperty({
        example: [ActionType.PHOTO, ActionType.CARD],
        description: 'Sinxronizatsiya qilinishi kerak bo‘lgan credential turlari',
        enum: ActionType,
        isArray: true,
    })
    @IsArray()
    @IsEnum(ActionType, { each: true })
    credentialTypes: ActionType[];
}

export class QueryDeviceDto extends QueryDto {
    @ApiProperty({
        example: [ActionType.PHOTO, ActionType.CARD],
        enum: ActionType,
        isArray: true,
        required: false,
    })
    @IsOptional()
    @Transform(({ value }) => {
        if (!value) return undefined;
        return Array.isArray(value) ? value : [value];
    })
    @IsArray() // Endi har doim massiv kelishini tekshirish mumkin
    @IsEnum(ActionType, { each: true })
    deviceTypes?: ActionType[];

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

    @ApiProperty({
        description: 'Filter by connection with gate',
        type: Boolean,
        required: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    isConnected?: boolean;
}

export class SyncCredentialsDto {
    @ApiProperty()
    @IsNumber()
    gateId: number;

    @ApiProperty()
    @IsNumber()
    employeeId: number;

    @ApiProperty({
        example: [5, 6, 7],
        description: 'credentialIds ro‘yxati',
        type: [Number],
    })
    @IsArray()
    @IsInt({ each: true })
    credentialIds: number[];
}
