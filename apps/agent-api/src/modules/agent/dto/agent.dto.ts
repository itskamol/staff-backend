import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsInt,
    IsDateString,
    IsArray,
    ValidateNested,
    IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// Base agent data structure
export class BaseAgentDto {
    @ApiProperty({ example: 'DESKTOP-ABC123' })
    @IsString()
    @IsNotEmpty()
    computerUid: string;

    @ApiProperty({ example: 'S-1-5-21-123456789-123456789-123456789-1001' })
    @IsString()
    @IsNotEmpty()
    userSid: string;
}

// Computer registration
export class RegisterComputerDto {
    @ApiProperty({ example: 'DESKTOP-ABC123' })
    @IsString()
    @IsNotEmpty()
    computerUid: string;

    @ApiProperty({ example: 'Windows 11 Pro', required: false })
    @IsOptional()
    @IsString()
    os?: string;

    @ApiProperty({ example: '192.168.1.100', required: false })
    @IsOptional()
    @IsString()
    ipAddress?: string;

    @ApiProperty({ example: '00:11:22:33:44:55', required: false })
    @IsOptional()
    @IsString()
    macAddress?: string;
}

// Computer user registration
export class RegisterComputerUserDto {
    @ApiProperty({ example: 'S-1-5-21-123456789-123456789-123456789-1001' })
    @IsString()
    @IsNotEmpty()
    sid: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'COMPANY', required: false })
    @IsOptional()
    @IsString()
    domain?: string;

    @ApiProperty({ example: 'john.doe' })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ example: false })
    @IsBoolean()
    isAdmin: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    isInDomain: boolean;
}

// Active Window Data
export class ActiveWindowDataDto {
    @ApiProperty({ example: '2024-09-27T10:30:00Z' })
    @IsDateString()
    datetime: string;

    @ApiProperty({ example: 'Visual Studio Code - main.ts' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: 'Code.exe' })
    @IsString()
    @IsNotEmpty()
    processName: string;

    @ApiProperty({
        example:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        required: false,
    })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiProperty({ example: 120 })
    @IsInt()
    activeTime: number;
}

export class ActiveWindowDto extends BaseAgentDto {
    @ApiProperty({ type: [ActiveWindowDataDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ActiveWindowDataDto)
    data: ActiveWindowDataDto[];
}

// Visited Site Data
export class VisitedSiteDataDto {
    @ApiProperty({ example: '2024-09-27T10:30:00Z' })
    @IsDateString()
    datetime: string;

    @ApiProperty({ example: 'GitHub - microsoft/vscode', required: false })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({ example: 'https://github.com/microsoft/vscode' })
    @IsString()
    @IsNotEmpty()
    url: string;

    @ApiProperty({ example: 'chrome.exe' })
    @IsString()
    @IsNotEmpty()
    processName: string;

    @ApiProperty({
        example:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        required: false,
    })
    @IsOptional()
    @IsString()
    icon?: string;

    @ApiProperty({ example: 300 })
    @IsInt()
    activeTime: number;
}

export class VisitedSiteDto extends BaseAgentDto {
    @ApiProperty({ type: [VisitedSiteDataDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VisitedSiteDataDto)
    data: VisitedSiteDataDto[];
}

// Screenshot Data
export class ScreenshotDataDto {
    @ApiProperty({ example: '2024-09-27T10:30:00Z' })
    @IsDateString()
    datetime: string;

    @ApiProperty({ example: 'Visual Studio Code', required: false })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiProperty({ example: '/screenshots/2024-09-27/screenshot_123456.png' })
    @IsString()
    @IsNotEmpty()
    filePath: string;

    @ApiProperty({ example: 'Code.exe' })
    @IsString()
    @IsNotEmpty()
    processName: string;

    @ApiProperty({
        example:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        required: false,
    })
    @IsOptional()
    @IsString()
    icon?: string;
}

export class ScreenshotDto extends BaseAgentDto {
    @ApiProperty({ type: [ScreenshotDataDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ScreenshotDataDto)
    data: ScreenshotDataDto[];
}

// User Session Data
export enum SessionType {
    UNLOCKED = 'UNLOCKED',
    LOCKED = 'LOCKED',
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
}

export class UserSessionDataDto {
    @ApiProperty({ example: '2024-09-27T09:00:00Z' })
    @IsDateString()
    startTime: string;

    @ApiProperty({ example: '2024-09-27T17:00:00Z', required: false })
    @IsOptional()
    @IsDateString()
    endTime?: string;

    @ApiProperty({ enum: SessionType, example: SessionType.LOGIN })
    @IsEnum(SessionType)
    sessionType: SessionType;
}

export class UserSessionDto extends BaseAgentDto {
    @ApiProperty({ type: [UserSessionDataDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UserSessionDataDto)
    data: UserSessionDataDto[];
}
