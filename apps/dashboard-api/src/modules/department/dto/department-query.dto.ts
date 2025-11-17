import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { QueryDto } from '../../../shared/dto';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

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
    @Type(() => Number)
    @IsInt()
    @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
    @ApiProperty({
        description: 'Filter by organization ID',
        type: Number,
        required: false,
        example: 1,
    })
    organizationId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
    @ApiProperty({
        description: 'Filter by parent ID',
        type: Number,
        required: false,
        example: 1,
    })
    parentId?: number;
}
