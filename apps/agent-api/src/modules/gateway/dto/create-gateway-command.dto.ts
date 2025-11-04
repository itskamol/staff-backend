import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { GatewayCommandPayload } from '@app/shared/gateway';

export class CreateGatewayCommandDto implements Omit<GatewayCommandPayload, 'id'> {
    @IsString()
    @IsNotEmpty()
    type!: string;

    @IsObject()
    payload!: Record<string, unknown>;

    @IsOptional()
    @IsBoolean()
    requiresAck?: boolean;
}

export class GatewayCommandResponseDto {
    id!: string;
    gatewayId!: string;
    type!: string;
    payload!: Record<string, unknown>;
    requiresAck?: boolean;
    status!: string;
    createdAt!: string;
    sentAt?: string;
    ackAt?: string;
    ackStatus?: string;
    ackError?: string;
}
