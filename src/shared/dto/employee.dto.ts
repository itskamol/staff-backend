import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEmployeeDto {
    @ApiProperty({
        description: "The employee's first name.",
        example: 'John',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    firstName: string;

    @ApiProperty({
        description: "The employee's last name.",
        example: 'Doe',
        maxLength: 50,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    lastName: string;

    @ApiProperty({
        description: 'The unique code for the employee.',
        example: 'EMP12345',
        maxLength: 20,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    employeeCode: string;

    @ApiProperty({
        description: 'The ID of the branch where the employee works.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    @IsString()
    @IsNotEmpty()
    branchId: string;

    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    departmentId?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@acme.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '123-456-7890',
        maxLength: 20,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @ApiProperty({
        description: 'Indicates if the employee is currently active.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateEmployeeDto {
    @ApiProperty({
        description: "The employee's first name.",
        example: 'John',
        maxLength: 50,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    firstName?: string;

    @ApiProperty({
        description: "The employee's last name.",
        example: 'Doe',
        maxLength: 50,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(50)
    lastName?: string;

    @ApiProperty({
        description: 'The unique code for the employee.',
        example: 'EMP12345',
        maxLength: 20,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(20)
    employeeCode?: string;

    @ApiProperty({
        description: 'The ID of the branch where the employee works.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    branchId?: string;

    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    departmentId?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@acme.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '123-456-7890',
        maxLength: 20,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(20)
    phone?: string;

    @ApiProperty({
        description: 'The storage key for the employee photo.',
        example: 'employees/12345/photo.jpg',
        required: false,
    })
    @IsOptional()
    @IsString()
    photoKey?: string;

    @ApiProperty({
        description: 'Indicates if the employee is currently active.',
        example: true,
        required: false,
    })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class EmployeeResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the employee.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    id: string;

    @ApiProperty({
        description: 'The ID of the organization this employee belongs to.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    organizationId: string;

    @ApiProperty({
        description: 'The ID of the branch where the employee works.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    })
    branchId: string;

    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        required: false,
    })
    departmentId?: string;

    @ApiProperty({
        description: "The employee's first name.",
        example: 'John',
    })
    firstName: string;

    @ApiProperty({
        description: "The employee's last name.",
        example: 'Doe',
    })
    lastName: string;

    @ApiProperty({
        description: 'The unique code for the employee.',
        example: 'EMP12345',
    })
    employeeCode: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@acme.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '123-456-7890',
        required: false,
    })
    phone?: string;

    @ApiProperty({
        description: 'The storage key for the employee photo.',
        example: 'employees/12345/photo.jpg',
        required: false,
    })
    photoKey?: string;

    @ApiProperty({
        description: 'Indicates if the employee is currently active.',
        example: true,
    })
    isActive: boolean;

    @ApiProperty({
        description: 'The date and time when the employee was created.',
        example: '2023-08-14T10:00:00.000Z',
    })
    createdAt: Date;

    @ApiProperty({
        description: 'The date and time when the employee was last updated.',
        example: '2023-08-14T10:00:00.000Z',
    })
    updatedAt: Date;
}

export class EmployeeCountResponseDto {
    @ApiProperty({
        description: 'The total number of employees.',
        example: 100,
    })
    count: number;
}

export class EmployeePhotoUploadResponseDto {
    @ApiProperty({
        description: 'The URL of the uploaded employee photo.',
        example: 'https://storage.example.com/employees/12345/photo.jpg',
    })
    photoUrl: string;

    @ApiProperty({
        description: 'The unique key of the uploaded photo in storage.',
        example: 'employees/12345/photo.jpg',
    })
    photoKey: string;

    @ApiProperty({
        description: 'The size of the uploaded photo in bytes.',
        example: 1024000,
    })
    fileSize: number;
}
