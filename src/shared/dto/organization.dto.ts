import { ApiProperty, PartialType } from '@nestjs/swagger';

import { DepartmentResponseDto } from './department.dto';
import { BaseCreateDto } from './base.dto';

export class CreateOrganizationDto extends BaseCreateDto {}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class OrganizationResponseDto extends CreateOrganizationDto {
    @ApiProperty({
        description: 'The unique identifier for the organization.',
        example: 1,
    })
    id: string;

    @ApiProperty({
        description: 'The date and time when the organization was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the organization was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;

    @ApiProperty({
        description: 'A list of departments within the organization.',
        type: () => [DepartmentResponseDto],
        required: false,
    })
    departments?: DepartmentResponseDto[];
}
