import { IsString, IsInt, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateHikvisionUserDto {
    @ApiProperty({
        example: '5',
        description: 'Xodimning noyob identifikatori (employeeNo)',
    })
    @IsString()
    employeeId: string;

    @ApiProperty({ example: 'normal', description: 'Foydalanuvchi turi' })
    @IsString()
    userType?: string;

    @ApiProperty({
        example: '2025-11-03T00:00:00',
        description: 'Foydalanuvchi amal qilish boshlanish vaqti',
    })
    @IsString()
    @IsOptional()
    beginTime?: string;

    @ApiProperty({
        example: '2035-12-31T23:59:59',
        description: 'Foydalanuvchi amal qilish tugash vaqti',
    })
    @IsString()
    @IsOptional()
    endTime?: string;
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
    @IsOptional()
    port?: number;

    @ApiProperty()
    @IsString()
    username: string;

    @ApiProperty()
    @IsString()
    password: string;
    protocol: 'http' | 'https';
}

export class CreatePlateDto extends HikvisionConfig {
    @ApiProperty({ example: '01A777AA', description: 'Avtomobil raqami' })
    @IsString()
    @IsNotEmpty()
    plateNo: string;

    @ApiProperty({
        example: '1',
        description: '"1" - Oq ro‘yxat (Ruxsat), "2" - Qora ro‘yxat (Taqiq)',
    })
    @IsString()
    @IsIn(['1', '2'])
    listType: string;
}

// Raqam tahrirlash uchun DTO
export class EditPlateDto extends HikvisionConfig {
    @ApiProperty({ example: '01A777AA', description: 'Eski raqam' })
    @IsString()
    @IsNotEmpty()
    oldPlateNo: string;

    @ApiProperty({ example: '01B888BB', description: 'Yangi raqam' })
    @IsString()
    @IsNotEmpty()
    newPlateNo: string;

    @ApiProperty({ example: '1', description: 'Ro‘yxat turi' })
    @IsString()
    @IsIn(['1', '2'])
    listType: string;
}

// Raqam o'chirish uchun DTO
export class DeletePlateDto extends HikvisionConfig {
    @ApiProperty({ example: '01A777AA', description: 'O‘chiriladigan raqam' })
    @IsString()
    @IsNotEmpty()
    plateNo: string;
}

export class CardDto {
    @ApiProperty({ example: '5', description: 'Xodimning noyob identifikatori (employeeNo)' })
    @IsString()
    @IsNotEmpty()
    employeeNo: string;

    @ApiProperty({ example: '1234567890', description: 'Karta raqami' })
    @IsString()
    @IsNotEmpty()
    cardNo: string;
}
