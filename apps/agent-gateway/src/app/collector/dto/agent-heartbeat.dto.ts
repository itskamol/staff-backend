import { IsString, IsDateString, IsOptional } from 'class-validator';

export class AgentHeartbeatDto {
  @IsString()
  status: string;

  @IsString()
  version: string;

  @IsDateString()
  timestamp: string;

  @IsOptional()
  systemInfo?: any;
}