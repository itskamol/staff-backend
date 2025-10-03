import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { VisitorCodeType } from '@prisma/client';

export class CreateOnetimeCodeDto {
    @ApiProperty({ 
        example: 1,
        description: 'Visitor ID'
    })
    @IsInt()
    @IsNotEmpty()
    visitorId: number;

    @ApiProperty({ 
        example: 'ONETIME',
        description: 'Code type',
        enum: VisitorCodeType
    })
    @IsEnum(VisitorCodeType)
    codeType: VisitorCodeType;

    @ApiProperty({ 
        example: 'VIS123456',
        description: 'Generated code'
    })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiProperty({ 
        example: '2024-08-25T09:00:00Z',
        description: 'Code start date'
    })
    @IsDateString()
    startDate: string;

    @ApiProperty({ 
        example: '2024-08-25T18:00:00Z',
        description: 'Code end date'
    })
    @IsDateString()
    endDate: string;

    @ApiProperty({ 
        example: 'Single day access',
        description: 'Additional details',
        required: false
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

    @ApiProperty({ 
        example: true,
        description: 'Code active status',
        required: false,
        default: true
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;
}

export class UpdateOnetimeCodeDto extends PartialType(CreateOnetimeCodeDto) {}

export class OnetimeCodeDto extends CreateOnetimeCodeDto {
    @ApiProperty({ example: 1, description: 'Code ID' })
    @IsInt()
    id: number;

    @ApiProperty({ example: '2023-10-01T12:00:00Z', description: 'Creation timestamp' })
    @IsString()
    createdAt: string;
}

export class OnetimeCodeWithRelationsDto extends OnetimeCodeDto {
    @ApiProperty({ description: 'Visitor information' })
    visitor?: {
        id: number;
        firstName: string;
        lastName: string;
        workPlace: string;
    };
}

export class ActivateCodeDto {
    @ApiProperty({ 
        example: true,
        description: 'Activate or deactivate code'
    })
    @IsBoolean()
    isActive: boolean;
}