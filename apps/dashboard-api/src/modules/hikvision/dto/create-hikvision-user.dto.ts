import { IsString, IsArray, IsISO8601, IsNumber, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RightPlanDto {
  @ApiProperty({
    example: 1,
    description: 'Qaysi eshik uchun kirish huquqi (doorNo)',
  })
  @IsNumber()
  doorNo: number;

  @ApiProperty({
    example: '1',
    description: 'Reja shablon raqami (planTemplateNo)',
  })
  @IsString()
  planTemplateNo: string;
}

export class CreateHikvisionUserDto {
  @ApiProperty({
    example: '5',
    description: 'Xodimning noyob identifikatori (employeeNo)',
  })
  @IsString()
  employeeId: string;
}


export interface HikvisionUser {
  employeeNo: string;
  name: string;
  userType: string;
  Valid: {
    enable: boolean;
    beginTime: string;
    endTime: string;
    timeType: string;
  };
  belongGroup: string;
  password: string;
  doorRight: string;
  RightPlan: Array<{
    doorNo: number;
    planTemplateNo: string;
  }>;
  maxOpenDoorTime: number;
  openDoorTime: number;
  roomNumber: number;
  floorNumber: number;
  localUIRight: boolean;
  gender: string;
  numOfCard: number;
  numOfFace: number;
  PersonInfoExtends: Array<{
    value: string;
  }>;
  closeDelayEnabled: boolean;
}


export class HikvisionConfig {
  @ApiProperty()
  @IsString()
  host: string;

  @ApiProperty()
  @IsInt()
  port: number;

  @ApiProperty()
  @IsString()

  username: string;

  @ApiProperty()
  @IsString()
  password: string;
  protocol: 'http' | 'https';
}
