import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, MinLength, IsInt } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Role } from '@app/shared/auth';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: Role, example: Role.HR })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsInt()
  organizationId?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ example: 'newpassword123', required: false })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}