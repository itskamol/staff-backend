import { Type } from 'class-transformer';
import {
    IsArray,
    IsISO8601,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class IngestRecordDto {
    @IsString()
    @IsNotEmpty()
    type!: string;

    @IsISO8601()
    occurredAt!: string;

    @IsObject()
    payload!: Record<string, unknown>;

    @IsOptional()
    @IsString()
    source?: string;
}

export class CollectorBatchDto {
    @IsString()
    @IsNotEmpty()
    channel!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IngestRecordDto)
    records!: IngestRecordDto[];

    @IsOptional()
    @IsObject()
    context?: Record<string, unknown>;

    @IsOptional()
    @IsString()
    gatewayId?: string;
}
