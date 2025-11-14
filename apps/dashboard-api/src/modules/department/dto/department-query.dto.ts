import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { QueryDto } from '../../../shared/dto';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class DepartmentQueryDto extends QueryDto {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => {
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    })
    @ApiProperty({
        description: 'Filter by active status',
        type: Boolean,
        required: false,
        example: true,
    })
    isActive?: boolean;

    @IsOptional()
    @IsString()
    @ApiProperty({
        description: 'Filter by organization ID',
        type: String,
        required: false,
        example: 'uuid',
    })
    organizationId?: string;
}
