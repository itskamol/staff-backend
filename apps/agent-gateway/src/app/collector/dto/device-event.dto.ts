import { IsString, IsDateString, IsOptional } from 'class-validator';

export class DeviceEventDto {
  @IsString()
  deviceId: string;

  @IsString()
  eventType: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  eventData?: any;
}