import { IsString, IsInt, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHikvisionUserDto {
  @ApiProperty({
    example: '5',
    description: 'Xodimning noyob identifikatori (employeeNo)',
  })
  @IsString()
  employeeId: string;

  @ApiProperty({example: 'normal', description: 'Foydalanuvchi turi'})
  @IsString()
  userType: string;

  @ApiProperty({example: '2025-11-03T00:00:00', description: 'Foydalanuvchi amal qilish boshlanish vaqti'})
  @IsString()
  @IsOptional()
  beginTime: string;

  @ApiProperty({example: '2035-12-31T23:59:59', description: 'Foydalanuvchi amal qilish tugash vaqti'})
  @IsString()
  @IsOptional()
  endTime: string;
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
