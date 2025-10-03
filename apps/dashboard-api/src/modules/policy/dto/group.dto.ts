import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';

export class CreateGroupDto {
    @ApiProperty({ 
        example: 'Social Media Sites',
        description: 'Group name'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ 
        example: 'WEBSITE',
        description: 'Resource type',
        enum: ResourceType
    })
    @IsEnum(ResourceType)
    type: ResourceType;

    @ApiProperty({ 
        example: true,
        description: 'Group active status',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}

export class GroupDto extends CreateGroupDto {
    @ApiProperty({ example: 1, description: 'Group ID' })
    @IsInt()
    id: number;

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

    @ApiProperty({ example: 2, description: 'Number of policies using this group', required: false })
    policyCount?: number;
}

export class AddResourceToGroupDto {
    @ApiProperty({ 
        example: [1, 2, 3],
        description: 'Array of resource IDs to add to group'
    })
    @IsInt({ each: true })
    resourceIds: number[];
}