import { IsInt, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { OptionType } from '@prisma/client';

export class CreatePolicyOptionDto {
    @ApiProperty({
        example: 1,
        description: 'Policy ID',
    })
    @IsInt()
    @IsNotEmpty()
    policyId: number;

    @ApiProperty({
        example: 1,
        description: 'Group ID',
    })
    @IsInt()
    @IsNotEmpty()
    groupId: number;

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
    @ApiProperty({ example: 1, description: 'Policy option ID' })
    @IsInt()
    id: number;

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
        example: 1,
        description: 'Policy ID',
    })
    @IsInt()
    @IsNotEmpty()
    policyId: number;

    @ApiProperty({
        example: [1, 2, 3],
        description: 'Array of group IDs',
    })
    @IsArray()
    @IsInt({ each: true })
    groupIds: number[];

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
        id: number;
        title: string;
    };

    @ApiProperty({ description: 'Group information' })
    group?: {
        id: number;
        name: string;
        type: string;
    };
}
