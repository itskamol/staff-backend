import { IsOptional, IsArray, ValidateNested, IsString, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class ActiveWindowDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  computer_uid: string;

  @IsString()
  user_sid: string;

  @IsOptional()
  @IsString()
  window_title?: string;

  @IsOptional()
  @IsString()
  process_name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsDateString()
  datetime?: string;

  @IsOptional()
  @IsNumber()
  duration_seconds?: number;
}

export class VisitedSiteDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  computer_uid: string;

  @IsString()
  user_sid: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  datetime?: string;

  @IsOptional()
  @IsNumber()
  duration_seconds?: number;
}

export class ScreenshotDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  computer_uid: string;

  @IsString()
  user_sid: string;

  @IsString()
  file_path: string;

  @IsOptional()
  @IsNumber()
  file_size?: number;

  @IsOptional()
  @IsDateString()
  datetime?: string;
}

export class UserSessionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  computer_uid: string;

  @IsString()
  user_sid: string;

  @IsString()
  session_type: string;

  @IsOptional()
  @IsDateString()
  datetime?: string;

  @IsOptional()
  metadata?: any;
}

export class MonitoringDataDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActiveWindowDto)
  activeWindows?: ActiveWindowDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisitedSiteDto)
  visitedSites?: VisitedSiteDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScreenshotDto)
  screenshots?: ScreenshotDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserSessionDto)
  userSessions?: UserSessionDto[];
}