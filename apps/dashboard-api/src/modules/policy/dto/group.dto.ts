import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsOptional,
    IsBoolean,
    IsInt,
    IsArray,
    ValidateNested,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import { QueryDto } from '@app/shared/utils';

export class CreateGroupDto {
    @ApiProperty({
        example: 'Social Media Sites',
        description: 'Group name',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: 'WEBSITE',
        description: 'Resource type',
        enum: ResourceType,
    })
    @IsEnum(ResourceType)
    type: ResourceType;

    @ApiProperty({
        example: 'uuid',
        description: 'Organization ID (auto-populated from user context)',
        required: false,
    })
    @IsString()
    @IsOptional()
    organizationId: string;

    @ApiProperty({
        example: ['uuid', 'uuid-2'],
        description: 'Array of resource IDs to include in the group',
    })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    resourceIds?: string[];

    @ApiProperty({
        example: ['ya.ru', 'facebook.com', 'twitter.com'],
        description: 'Array of resources to create and include in the group',
    })
    @IsArray()
    @IsOptional()
    resources?: string[];

    @ApiProperty({
        example: true,
        description: 'Group active status',
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class GroupDto extends CreateGroupDto {
    @ApiProperty({ example: 'uuid', description: 'Group ID' })
    @IsInt()
    id: string;

    @ApiProperty({ example: 'uuid', description: 'Organization ID' })
    @IsInt()
    organizationId!: string;

    @ApiProperty({ example: true, description: 'Group active status' })
    @IsBoolean()
    isActive: boolean;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Group creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: '2023-10-10T12:00:00Z', description: 'Group last update timestamp' })
    @IsString()
    updatedAt: string;

    @ApiProperty({ example: 5, description: 'Number of resources in group', required: false })
    resourceCount?: number;

    @ApiProperty({
        example: 2,
        description: 'Number of policies using this group',
        required: false,
    })
    policyCount?: number;
}

export class AddResourceToGroupDto {
    @ApiProperty({
        example: ['uuid', 'uuid-2'],
        description: 'Array of resource IDs to add to group',
    })
    @IsString({ each: true })
    resourceIds: string[];
}

export class GroupQueryDto extends QueryDto {
    @ApiProperty({
        example: ResourceType.WEBSITE,
        description: 'Filter by resource type',
        enum: ResourceType,
        required: false,
    })
    @IsEnum(ResourceType)
    @IsOptional()
    type?: ResourceType;
}
