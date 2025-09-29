import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseCreateDto } from './base.dto';

export class CreateDepartmentDto extends BaseCreateDto {
    @ApiProperty({
        description: 'The ID of the organization this department belongs to.',
        example: 2,
    })
    @IsNumber()
    @IsNotEmpty()
    organizationId: number;

    @ApiProperty({
        description: 'The ID of the parent department, if this is a sub-department.',
        example: 2,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    parentId?: number;
}

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class DepartmentResponseDto extends CreateDepartmentDto {
    @ApiProperty({
        description: 'The unique identifier for the department.',
        example: 2,
    })
    id: string;

    @ApiProperty({
        description: 'The date and time when the department was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the department was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'A list of child departments.',
        type: () => [DepartmentResponseDto],
        required: false,
    })
    children?: DepartmentResponseDto[];

    @ApiProperty({
        description: 'The parent department.',
        type: () => DepartmentResponseDto,
        required: false,
    })
    parent?: DepartmentResponseDto;
}
