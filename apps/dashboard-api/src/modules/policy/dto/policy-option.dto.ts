import { IsInt, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsArray, IsString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { OptionType } from '@prisma/client';

export class CreatePolicyOptionDto {
    @ApiProperty({
        example: 'uuid',
        description: 'Policy ID',
    })
    @IsString()
    @IsNotEmpty()
    policyId: string;

    @ApiProperty({
        example: 'uuid',
        description: 'Group ID',
    })
    @IsString()
    @IsNotEmpty()
    groupId: string;

    @ApiProperty({
        example: OptionType.ACTIVE_WINDOW,
        description: 'Option type',
        enum: OptionType,
    })
    @IsEnum(OptionType)
    type: OptionType;

    @ApiProperty({
        example: true,
        description: 'Policy option active status',
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdatePolicyOptionDto extends PartialType(CreatePolicyOptionDto) {}

export class PolicyOptionDto extends CreatePolicyOptionDto {
    @ApiProperty({ example: 'uuid', description: 'Policy option ID' })
    @IsInt()
    id: string;

    @ApiProperty({ example: true, description: 'Policy option active status' })
    @IsBoolean()
    isActive: boolean;

    @ApiProperty({
        example: '2023-10-01T12:00:00Z',
        description: 'Policy option creation timestamp',
    })
    createdAt: string;

    @ApiProperty({
        example: '2023-10-10T12:00:00Z',
        description: 'Policy option last update timestamp',
    })
    updatedAt: string;
}

export class BulkCreatePolicyOptionDto {
    @ApiProperty({
        example: 'uuid',
        description: 'Policy ID',
    })
    @IsString()
    @IsNotEmpty()
    policyId: string;

    @ApiProperty({
        example: ['uuid', 'uuid-2'],
        description: 'Array of group IDs',
    })
    @IsArray()
    @IsString({ each: true })
    groupIds: string[];

    @ApiProperty({
        example: OptionType.ACTIVE_WINDOW,
        description: 'Option type for all groups',
        enum: OptionType,
    })
    @IsEnum(OptionType)
    type: OptionType;
}

export class BulkResponsePolicyOptionDto {
    @ApiProperty({ example: 3, description: 'Number of policy options successfully created' })
    created: number;

    @ApiProperty({ example: 1, description: 'Number of policy options that failed to be created' })
    skipped: number;
}

export class PolicyOptionWithRelationsDto extends PolicyOptionDto {
    @ApiProperty({ description: 'Policy information' })
    policy?: {
        id: string;
        title: string;
    };

    @ApiProperty({ description: 'Group information' })
    group?: {
        id: string;
        name: string;
        type: string;
    };
}
