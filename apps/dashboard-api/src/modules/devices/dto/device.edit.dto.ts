import { ApiProperty } from '@nestjs/swagger';
import { AuthMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDeviceAuthDto {
    @ApiProperty({ enum: AuthMode, example: AuthMode.CARD_AND_PASSWORD })
    @IsEnum(AuthMode)
    authMode: AuthMode;
}

export class UpdateResultDeviceDisplayDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    showPicture: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    showName: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    showEmployeeNo: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    voicePrompt: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    @IsOptional()
    desensitiseName?: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    @IsOptional()
    desensitiseEmployeeNo?: boolean;
}

export class UpdateDeviceTimeDto {
    @ApiProperty({
        required: false,
        example: '2026-01-15T16:10:00',
        description: 'Agar yuborilmasa, server hozirgi vaqtini ishlatadi',
    })
    @IsString()
    localTime: string;
}
