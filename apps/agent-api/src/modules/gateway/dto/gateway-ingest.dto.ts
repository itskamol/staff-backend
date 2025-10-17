import { GatewayIngestBatchRequest, GatewayIngestRecord } from '@app/shared/gateway';
import { Type } from 'class-transformer';
import {
    IsArray,
    IsISO8601,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    MinLength,
    ValidateNested,
} from 'class-validator';

export class GatewayIngestRecordDto implements GatewayIngestRecord {
    @IsString()
    @MinLength(1)
    type!: string;

    @IsISO8601()
    occurredAt!: string;

    @IsObject()
    payload!: Record<string, unknown>;

    @IsOptional()
    @IsString()
    source?: string;
}

export class GatewayIngestBatchDto implements GatewayIngestBatchRequest {
    @IsString()
    @MinLength(1)
    gatewayId!: string;

    @IsOptional()
    @IsNumber()
    organizationId?: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GatewayIngestRecordDto)
    records!: GatewayIngestRecordDto[];
}
