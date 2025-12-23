import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateResourceDto {
    @ApiProperty({
        example: ResourceType.APPLICATION,
        description: 'Type of the resource',
        enum: ResourceType,
    })
    @IsString()
    @IsEnum(ResourceType)
    @IsNotEmpty()
    type: ResourceType;

    @ApiProperty({
        example: 'code',
        description: 'Name of the resource',
    })
    @IsString()
    @IsNotEmpty()
    value: string;

    @ApiProperty({
        example: 1,
        description: 'Organization ID (auto-populated from user context)',
        required: false,
    })
    @IsInt()
    @IsOptional()
    organizationId?: number;
}

export class ResourceQueryDto extends QueryDto {
    @ApiProperty({
        example: ResourceType.APPLICATION,
        description: 'Filter by resource type',
        enum: ResourceType,
        required: false,
    })
    @IsEnum(ResourceType)
    @IsOptional()
    type?: ResourceType;

    @ApiProperty({
        example: 1,
        description: 'Filter by group ID',
        required: false,
    })
    @IsInt()
    @IsOptional()
    groupId?: number;
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}

export class ResourceResponseDto extends CreateResourceDto {
    @ApiProperty({
        example: 1,
        description: 'Unique identifier for the resource',
    })
    id: number;

    @ApiProperty({
        example: 1,
        description: 'Organization ID',
    })
    organizationId!: number;

    @ApiProperty({
        example: '2024-01-01T00:00:00.000Z',
        description: 'Timestamp when the resource was created',
    })
    createdAt: Date;
}
