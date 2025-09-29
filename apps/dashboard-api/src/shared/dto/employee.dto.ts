import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, IsNumber } from 'class-validator';

export class CreateEmployeeDto {
    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 1,
    })
    @IsNumber()
    @IsNotEmpty()
    departmentId: number;

    @ApiProperty({
        description: 'The ID of the policy assigned to the employee.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    policyId?: number;

    @ApiProperty({
        description: "The employee's full name.",
        example: 'John Doe',
        maxLength: 100,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @ApiProperty({
        description: "The employee's address.",
        example: '123 Main St, City, Country',
        required: false,
    })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '+998901234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@company.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'The storage path for employee photo.',
        example: 'employees/photos/john-doe.jpg',
        required: false,
    })
    @IsOptional()
    @IsString()
    photo?: string;

    @ApiProperty({
        description: 'Additional details about the employee.',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

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
        description: 'The ID of the department where the employee belongs.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    departmentId?: number;

    @ApiProperty({
        description: 'The ID of the policy assigned to the employee.',
        example: 1,
        required: false,
    })
    @IsOptional()
    @IsNumber()
    policyId?: number;

    @ApiProperty({
        description: "The employee's full name.",
        example: 'John Doe',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name?: string;

    @ApiProperty({
        description: "The employee's address.",
        example: '123 Main St, City, Country',
        required: false,
    })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '+998901234567',
        required: false,
    })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@company.com',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        description: 'The storage path for employee photo.',
        example: 'employees/photos/john-doe.jpg',
        required: false,
    })
    @IsOptional()
    @IsString()
    photo?: string;

    @ApiProperty({
        description: 'Additional details about the employee.',
        required: false,
    })
    @IsOptional()
    @IsString()
    additionalDetails?: string;

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
        example: 1,
    })
    id: number;

    @ApiProperty({
        description: 'The ID of the department where the employee belongs.',
        example: 1,
    })
    departmentId: number;

    @ApiProperty({
        description: 'The ID of the policy assigned to the employee.',
        example: 1,
        required: false,
    })
    policyId?: number;

    @ApiProperty({
        description: "The employee's full name.",
        example: 'John Doe',
    })
    name: string;

    @ApiProperty({
        description: "The employee's address.",
        example: '123 Main St, City, Country',
        required: false,
    })
    address?: string;

    @ApiProperty({
        description: "The employee's phone number.",
        example: '+998901234567',
        required: false,
    })
    phone?: string;

    @ApiProperty({
        description: "The employee's email address.",
        example: 'john.doe@company.com',
        required: false,
    })
    email?: string;

    @ApiProperty({
        description: 'The storage path for employee photo.',
        example: 'employees/photos/john-doe.jpg',
        required: false,
    })
    photo?: string;

    @ApiProperty({
        description: 'Additional details about the employee.',
        required: false,
    })
    additionalDetails?: string;

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

    @ApiProperty({
        description: 'Department information',
        required: false,
    })
    department?: {
        id: number;
        fullName: string;
        shortName: string;
    };

    @ApiProperty({
        description: 'Policy information',
        required: false,
    })
    policy?: {
        id: number;
        title: string;
    };
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

export class AssignCardDto {
    @ApiProperty({
        description: 'The ID of the card to assign to the employee.',
        example: 'card-12345',
    })
    @IsString()
    @IsNotEmpty()
    cardId: string;
}

export class AssignCarDto {
    @ApiProperty({
        description: 'The ID of the car to assign to the employee.',
        example: 'car-12345',
    })
    @IsString()
    @IsNotEmpty()
    carId: string;
}

export class LinkComputerUserDto {
    @ApiProperty({
        description: 'The ID of the computer user to link to the employee.',
        example: 'computer-user-12345',
    })
    @IsString()
    @IsNotEmpty()
    computerUserId: string;
}

export class EntryLogResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the entry log.',
        example: 'log-12345',
    })
    id: string;

    @ApiProperty({
        description: 'The employee ID.',
        example: 'emp-12345',
    })
    employeeId: string;

    @ApiProperty({
        description: 'The entry timestamp.',
        example: '2023-08-14T08:00:00.000Z',
    })
    entryTime: Date;

    @ApiProperty({
        description: 'The exit timestamp.',
        example: '2023-08-14T17:00:00.000Z',
        required: false,
    })
    exitTime?: Date;

    @ApiProperty({
        description: 'The location of entry.',
        example: 'Main Gate',
    })
    location: string;
}

export class ActivityReportResponseDto {
    @ApiProperty({
        description: 'The employee ID.',
        example: 'emp-12345',
    })
    employeeId: string;

    @ApiProperty({
        description: 'The report period start date.',
        example: '2023-08-01T00:00:00.000Z',
    })
    periodStart: Date;

    @ApiProperty({
        description: 'The report period end date.',
        example: '2023-08-31T23:59:59.000Z',
    })
    periodEnd: Date;

    @ApiProperty({
        description: 'Total working hours in the period.',
        example: 160,
    })
    totalHours: number;

    @ApiProperty({
        description: 'Number of days present.',
        example: 20,
    })
    daysPresent: number;

    @ApiProperty({
        description: 'Number of days absent.',
        example: 2,
    })
    daysAbsent: number;
}

export class ComputerUserResponseDto {
    @ApiProperty({
        description: 'The unique identifier for the computer user.',
        example: 'comp-user-12345',
    })
    id: string;

    @ApiProperty({
        description: 'The username.',
        example: 'john.doe',
    })
    username: string;

    @ApiProperty({
        description: 'The computer name.',
        example: 'DESKTOP-ABC123',
    })
    computerName: string;

    @ApiProperty({
        description: 'The employee ID linked to this computer user.',
        example: 'emp-12345',
    })
    employeeId: string;

    @ApiProperty({
        description: 'Whether the computer user is active.',
        example: true,
    })
    isActive: boolean;
}
