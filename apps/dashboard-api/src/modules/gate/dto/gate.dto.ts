import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateGateDto {
    @ApiProperty({ 
        example: 'Main Gate',
        description: 'Gate name'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({example: 'uuid', description: 'Organization Id'})
    @IsString()
    organizationId: string
}

export class UpdateGateDto extends PartialType(CreateGateDto) {}

export class GateDto extends CreateGateDto {
    @ApiProperty({ example: 'uuid', description: 'Gate ID' })
    @IsString()
    id: string;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: 5, description: 'Total devices count', required: false })
    devicesCount?: number;

    @ApiProperty({ example: 150, description: 'Total actions count', required: false })
    actionsCount?: number;
}