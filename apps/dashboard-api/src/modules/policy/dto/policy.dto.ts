import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreatePolicyDto {
    @ApiProperty({ example: 'Standard Monitoring Policy' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    activeWindow: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    screenshot: boolean;

    @ApiProperty({ example: true })
    @IsBoolean()
    visitedSites: boolean;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    screenshotOptionsId?: number;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    visitedSitesOptionsId?: number;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    activeWindowsOptionsId?: number;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {}
