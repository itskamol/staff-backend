import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateEmployeeDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    departmentId: number;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    policyId?: number;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'Toshkent sh., Chilonzor tumani', required: false })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ example: '+998901234567', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'john.doe@company.uz', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: 'https://example.com/photo.jpg', required: false })
    @IsOptional()
    @IsString()
    photo?: string;

    @ApiProperty({ example: 'Senior Developer', required: false })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    @IsInt()
    departmentId?: number;
}

export class LinkComputerUserDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    computerUserId: number;
}
