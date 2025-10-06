import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmployeeGroupDto {
    @ApiProperty({
        example: 'Sales Team',
        description: 'Employee group name',
        maxLength: 255,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiProperty({
        example: 'Group for all sales department employees',
        description: 'Detailed description of the employee group',
        required: false,
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({
        example: 1,
        description: 'Policy ID to assign to this employee group',
        required: false,
    })
    @IsOptional()
    @IsInt()
    policyId?: number;

    @ApiProperty({
        example: true,
        description: 'Group active status',
        required: false,
        default: true,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({
        example: 1,
        description: 'Organization ID (auto-populated from user context)',
        required: false,
    })
    @IsInt()
    @IsOptional()
    organizationId?: number;
}

export class UpdateEmployeeGroupDto extends PartialType(CreateEmployeeGroupDto) {}

export class EmployeeGroupDto extends CreateEmployeeGroupDto {
    @ApiProperty({
        example: 1,
        description: 'Employee group ID',
    })
    @IsInt()
    id: number;

    @ApiProperty({
        example: 1,
        description: 'Organization ID',
    })
    @IsInt()
    organizationId!: number;

    @ApiProperty({
        example: false,
        description: 'Is this the default group',
    })
    @IsBoolean()
    isDefault: boolean;

    @ApiProperty({
        example: true,
        description: 'Group active status',
    })
    @IsBoolean()
    isActive: boolean;

    @ApiProperty({
        example: '2023-10-01T12:00:00Z',
        description: 'Group creation timestamp',
    })
    createdAt: Date;

    @ApiProperty({
        example: '2023-10-10T12:00:00Z',
        description: 'Group last update timestamp',
    })
    updatedAt: Date;

    @ApiProperty({
        example: 15,
        description: 'Number of employees in this group',
        required: false,
    })
    employeeCount?: number;
}

export class EmployeeGroupWithRelationsDto extends EmployeeGroupDto {
    @ApiProperty({
        description: 'Organization details',
        required: false,
    })
    organization?: {
        id: number;
        name: string;
    };

    @ApiProperty({
        description: 'Employees in this group',
        required: false,
        type: 'array',
    })
    employees?: Array<{
        id: number;
        name: string;
        email?: string;
    }>;
}
