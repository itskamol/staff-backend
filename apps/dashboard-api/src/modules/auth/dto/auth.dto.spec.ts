import { validate } from 'class-validator';
import { LoginDto, RefreshTokenDto } from './auth.dto';

describe('Auth DTOs', () => {
  describe('LoginDto', () => {
    it('should pass validation with correct data', async () => {
      const dto = new LoginDto();
      dto.username = 'test@example.com';
      dto.password = 'password123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with an invalid email', async () => {
      const dto = new LoginDto();
      dto.username = 'invalid-email';
      dto.password = 'password123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });

    it('should fail validation with a short password', async () => {
      const dto = new LoginDto();
      dto.username = 'test@example.com';
      dto.password = '123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });
  });

  describe('RefreshTokenDto', () => {
    it('should pass validation with a non-empty refresh token', async () => {
      const dto = new RefreshTokenDto();
      dto.refreshToken = 'some-refresh-token';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail validation with an empty refresh token', async () => {
      const dto = new RefreshTokenDto();
      dto.refreshToken = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });
  });
});