import { QueryDto } from '@app/shared/utils';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
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
        example: 'uuid',
        description: 'Organization ID (auto-populated from user context)',
        required: false,
    })
    @IsString()
    @IsOptional()
    organizationId?: string;
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
        example: 'uuid',
        description: 'Filter by group ID',
        required: false,
    })
    @IsString()
    @IsOptional()
    groupId?: string;
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}

export class ResourceResponseDto extends CreateResourceDto {
    @ApiProperty({
        example: 'uuid',
        description: 'Unique identifier for the resource',
    })
    id: string;

    @ApiProperty({
        example: 'uuid',
        description: 'Organization ID',
    })
    organizationId!: string;

    @ApiProperty({
        example: '2024-01-01T00:00:00.000Z',
        description: 'Timestamp when the resource was created',
    })
    createdAt: Date;
}
