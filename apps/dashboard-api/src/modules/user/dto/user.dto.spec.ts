import { validate } from 'class-validator';
import { CreateUserDto, UpdateUserDto } from './user.dto';
import { Role } from '@app/shared/auth';

describe('User DTOs', () => {
    describe('CreateUserDto', () => {
        it('should pass validation with correct data', async () => {
            const dto = new CreateUserDto();
            dto.name = 'John Doe';
            dto.username = 'john.doe@example.com';
            dto.password = 'password123';
            dto.role = Role.EMPLOYEE;
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should fail validation with an invalid email', async () => {
            const dto = new CreateUserDto();
            dto.name = 'John Doe';
            dto.username = 'invalid-email';
            dto.password = 'password123';
            dto.role = Role.EMPLOYEE;
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('isEmail');
        });

        it('should fail validation with a short password', async () => {
            const dto = new CreateUserDto();
            dto.name = 'John Doe';
            dto.username = 'john.doe@example.com';
            dto.password = '123';
            dto.role = Role.EMPLOYEE;
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('minLength');
        });
    });

    describe('UpdateUserDto', () => {
        it('should pass validation with a valid password', async () => {
            const dto = new UpdateUserDto();
            dto.password = 'newpassword123';
            const errors = await validate(dto);
            expect(errors.length).toBe(0);
        });

        it('should fail validation with a short password', async () => {
            const dto = new UpdateUserDto();
            dto.password = '123';
            const errors = await validate(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].constraints).toHaveProperty('minLength');
        });
    });
});
