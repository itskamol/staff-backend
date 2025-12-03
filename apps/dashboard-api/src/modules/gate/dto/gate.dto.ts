import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateGateDto {
    @ApiProperty({
        example: 'Main Gate',
        description: 'Gate name',
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        example: true,
        description: 'Status',
    })
    @IsBoolean()
    @IsOptional()
    isActive: boolean;

    @ApiProperty({ example: [1, 2, 3], description: 'Organizations Ids' })
    @IsArray()
    @IsOptional()
    @IsInt({ each: true })
    organizationsIds: number[];
}

export class UpdateGateDto extends PartialType(CreateGateDto) {}

export class GateDto extends CreateGateDto {
    @ApiProperty({ example: 1, description: 'Gate ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: 5, description: 'Total devices count', required: false })
    devicesCount?: number;

    @ApiProperty({ example: 150, description: 'Total actions count', required: false })
    actionsCount?: number;
}

export class AssignGateWithOrgDto {
    @ApiProperty({ example: [1, 2, 3], description: 'Organizations Ids' })
    @IsArray()
    @IsOptional()
    @IsInt({ each: true })
    gatesIds: number[];

    @ApiProperty({ example: [1, 2, 3], description: 'Gates Ids' })
    @IsArray()
    @IsOptional()
    @IsInt({ each: true })
    organizationsIds: number[];
}
