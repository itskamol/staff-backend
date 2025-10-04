import { ApiProperty } from '@nestjs/swagger';
import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsPhoneNumber,
    IsString,
    MaxLength,
} from 'class-validator';

export class BaseCreateDto {
    @ApiProperty({
        description: 'The name',
        example: 'Acme Corporation',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    fullName!: string;

    @ApiProperty({
        description: 'The short name',
        example: 'Acme',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    shortName!: string;

    @ApiProperty({
        description: 'An email address.',
        example: 'user@demo.com',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsEmail()
    @MaxLength(500)
    email?: string;

    @ApiProperty({
        description: 'A contact phone number.',
        example: '+1234567890',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsPhoneNumber("UZ")
    @MaxLength(500)
    phone?: string;

    @ApiProperty({
        description: 'An address description',
        example: '123 Main St, Anytown, USA',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;

    @ApiProperty({
        description: 'Additional details about the organization in key-value pairs.',
        example: 'some additional details',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;
}