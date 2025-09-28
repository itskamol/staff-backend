import { IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateOrganizationDto {
    @ApiProperty({ example: 'Aloqachi Technologies LLC' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'Aloqachi' })
    @IsString()
    @IsNotEmpty()
    shortName: string;

    @ApiProperty({ example: 'Toshkent sh., Chilonzor tumani', required: false })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({ example: '+998901234567', required: false })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({ example: 'info@aloqachi.uz', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ example: 'https://example.com/logo.png', required: false })
    @IsOptional()
    @IsString()
    logo?: string;

    @ApiProperty({ example: 'IT kompaniyasi', required: false })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
