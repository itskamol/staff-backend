import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DeleteUserDto {
  @ApiProperty({ example: 'EMP123456', description: 'Employee Number of the user to delete' })
  @IsString()
  employeeNo: string;
}
