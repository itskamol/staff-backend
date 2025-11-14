import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateComputerUserDto {
    @ApiProperty({ 
        example: 'S-1-5-21-123456789-987654321-111111111-1001',
        description: 'Windows Security Identifier'
    })
    @IsString()
    @IsNotEmpty()
    sid: string;

    @ApiProperty({ 
        example: 'uuid',
        description: 'Computer ID'
    })
    @IsString()
    @IsNotEmpty()
    computer_id: string;

    @ApiProperty({ 
        example: 'John Doe',
        description: 'User display name'
    })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ 
        example: 'COMPANY',
        description: 'Domain name',
        required: false
    })
    @IsOptional()
    @IsString()
    domain?: string;

    @ApiProperty({ 
        example: 'j.doe',
        description: 'Username'
    })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ 
        example: false,
        description: 'Is user admin',
        required: false,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    is_admin?: boolean = false;

    @ApiProperty({ 
        example: true,
        description: 'Is user in domain',
        required: false,
        default: false
    })
    @IsOptional()
    @IsBoolean()
    is_in_domain?: boolean = false;

    @ApiProperty({ 
        example: true,
        description: 'User active status',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean = true;
}

export class UpdateComputerUserDto extends PartialType(CreateComputerUserDto) {}

export class ComputerUserDto extends CreateComputerUserDto {
    @ApiProperty({ example: 'uuid', description: 'Computer user ID' })
    @IsString()
    id: number;

    @ApiProperty({ example: 'uuid', description: 'Linked employee ID', required: false })
    @IsOptional()
    @IsString()
    employee_id?: string;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;

    @ApiProperty({ example: '2023-10-10T12:00:00Z', description: 'Last update timestamp' })
    @IsString()
    updatedAt: string;
}

export class LinkEmployeeDto {
    @ApiProperty({ 
        example: 'uuid',
        description: 'Employee ID to link'
    })
    @IsString()
    @IsNotEmpty()
    employee_id: string;
}