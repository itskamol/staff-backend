import { ApiProperty, PartialType } from '@nestjs/swagger';
import { ResourceType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

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
}

export class UpdateResourceDto extends PartialType(CreateResourceDto) {}

export class ResourceResponseDto extends CreateResourceDto {
    @ApiProperty({
        example: 1,
        description: 'Unique identifier for the resource',
    })
    id: number;

    @ApiProperty({
        example: '2024-01-01T00:00:00.000Z',
        description: 'Timestamp when the resource was created',
    })
    createdAt: Date;
}
