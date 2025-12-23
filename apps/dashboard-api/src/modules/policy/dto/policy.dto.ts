import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsBoolean,
    IsInt,
    ValidateIf,
    IsEnum,
    IsArray,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { OptionType } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

class RuleTypeDto {
    @ApiProperty({
        example: [1, 2, 3],
        description: 'Array of group IDs',
    })
    @IsInt({ each: true })
    @IsArray()
    @IsOptional()
    useful?: number[];

    @ApiProperty({
        example: [1, 2, 3],
        description: 'Array of group IDs',
    })
    @IsInt({ each: true })
    @IsArray()
    @IsOptional()
    unuseful?: number[];
}

export class CreatePolicyOptionDto extends RuleTypeDto {
    @ApiProperty({
        example: OptionType.ACTIVE_WINDOW,
        description: 'Option type',
        enum: OptionType,
    })
    @IsEnum(OptionType)
    type: OptionType;
}

export class CreatePolicyDto {
    @ApiProperty({
        example: 'Standard Monitoring Policy',
        description: 'Policy title',
    })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiProperty({
        example: true,
        description: 'Enable active window monitoring',
    })
    @IsBoolean()
    isActiveWindowEnabled: boolean;

    @ApiProperty({
        example: true,
        description: 'Enable screenshot capture',
    })
    @IsBoolean()
    isScreenshotEnabled: boolean;

    @ApiProperty({
        example: true,
        description: 'Enable visited sites monitoring',
    })
    @IsBoolean()
    isVisitedSitesEnabled: boolean;

    @ApiProperty({
        example: 1,
        description: 'Organization ID to which the policy belongs',
    })
    @IsInt()
    @IsNotEmpty({ message: 'Organization ID is required' })
    organizationId: number;

    @ApiProperty({
        example: 60,
        description: 'Screenshot interval in seconds (Required when isScreenshotEnabled is true)',
        required: false,
        minimum: 1,
        maximum: 3600,
    })
    @ValidateIf(o => o.isScreenshotEnabled === true)
    @IsNotEmpty({ message: 'Screenshot interval is required when screenshot is enabled' })
    @IsInt()
    screenshotInterval?: number;

    @ApiProperty({
        example: false,
        description: 'Capture screenshots in grayscale (Required when isScreenshotEnabled is true)',
        required: false,
    })
    @ValidateIf(o => o.isScreenshotEnabled === true)
    @IsNotEmpty({ message: 'Screenshot grayscale setting is required when screenshot is enabled' })
    @IsBoolean()
    screenshotIsGrayscale?: boolean;

    @ApiProperty({
        example: false,
        description:
            'Capture all windows or active window only (Required when isScreenshotEnabled is true)',
        required: false,
    })
    @ValidateIf(o => o.isScreenshotEnabled === true)
    @IsNotEmpty({
        message: 'Screenshot capture all setting is required when screenshot is enabled',
    })
    @IsBoolean()
    screenshotCaptureAll?: boolean;

    @ApiProperty({
        type: () => [CreatePolicyOptionDto],
        description: 'Array of policy options',
    })
    @IsArray()
    @IsOptional()
    options?: CreatePolicyOptionDto[];

    @ApiProperty({
        example: true,
        description: 'Policy active status',
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {}

export class PolicyDto extends CreatePolicyDto {
    @ApiProperty({ example: 1, description: 'Policy ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: true, description: 'Policy active status' })
    @IsBoolean()
    isActive: boolean;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Policy creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: '2023-10-10T12:00:00Z', description: 'Policy last update timestamp' })
    @IsString()
    updatedAt: string;
}

export class PolicyQueryDto extends QueryDto {
    @ApiProperty({
        description: 'Filter by active window',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    isActiveWindowEnabled?: boolean;

    @ApiProperty({
        description: 'Filter by screenshot',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    isScreenshotEnabled?: boolean;

    @ApiProperty({
        description: 'Filter by visited sites',
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    isVisitedSitesEnabled?: boolean;
}
