import { IsBoolean, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { QueryDto } from 'apps/dashboard-api/src/shared/dto';

export class DepartmentQueryDto extends QueryDto {
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

    @ApiProperty({
        description: 'Filter by SubDepartment',
        type: Boolean,
        required: false,
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
    isSubDepartment?: boolean;
}
