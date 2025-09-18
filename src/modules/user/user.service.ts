import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { LoggerService } from '@/core/logger';
import { PasswordUtil } from '@/shared/utils';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from '@/shared/dto';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new user
     */
    async createUser(createUserDto: CreateUserDto, correlationId?: string): Promise<User> {
        // Validate password strength
        const passwordValidation = PasswordUtil.validatePassword(createUserDto.password);
        if (!passwordValidation.isValid) {
            throw new ConflictException(
                `Password validation failed: ${passwordValidation.errors.join(', ')}`
            );
        }

        // Hash password
        const passwordHash = await PasswordUtil.hash(createUserDto.password);

        // Create user
        const user = await this.userRepository.create({
            ...createUserDto,
            password: passwordHash,
        });

        this.logger.logUserAction(user.id, 'USER_CREATED', {
            username: user.username,
            correlationId,
        });

        return user;
    }

    /**
     * Find user by ID
     */
    async findById(id: number): Promise<User> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    /**
     * Find user by email
     */
    async findByUsername(username: string): Promise<User | null> {
        return this.userRepository.findByUsername(username);
    }

    /**
     * Update user
     */
    async updateUser(
        id: number,
        updateUserDto: UpdateUserDto,
        correlationId?: string
    ): Promise<User> {
        const existingUser = await this.userRepository.findById(id);
        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        const updatedUser = await this.userRepository.update(id, updateUserDto);

        this.logger.logUserAction(id, 'USER_UPDATED', {
            changes: updateUserDto,
            correlationId,
        });

        return updatedUser;
    }

    /**
     * Change user password
     */
    async changePassword(
        userId: number,
        changePasswordDto: ChangePasswordDto,
        correlationId?: string
    ): Promise<void> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await PasswordUtil.compare(
            changePasswordDto.currentPassword,
            user.password
        );
        if (!isCurrentPasswordValid) {
            this.logger.logUserAction(userId, 'PASSWORD_CHANGE_FAILED_INVALID_CURRENT', {
                correlationId,
            });
            throw new ConflictException('Current password is incorrect');
        }

        // Validate new password strength
        const passwordValidation = PasswordUtil.validatePassword(changePasswordDto.newPassword);
        if (!passwordValidation.isValid) {
            throw new ConflictException(
                `Password validation failed: ${passwordValidation.errors.join(', ')}`
            );
        }

        // Hash new password
        const newPasswordHash = await PasswordUtil.hash(changePasswordDto.newPassword);

        // Update password
        await this.userRepository.update(userId, { password: newPasswordHash });

        this.logger.logUserAction(userId, 'PASSWORD_CHANGED', { correlationId });
    }

    /**
     * Deactivate user
     */
    async deactivateUser(id: number, correlationId?: string): Promise<User> {
        const user = await this.updateUser(id, { isActive: false }, correlationId);

        this.logger.logUserAction(id, 'USER_DEACTIVATED', { correlationId });

        return user;
    }

    /**
     * Activate user
     */
    async activateUser(id: number, correlationId?: string): Promise<User> {
        const user = await this.updateUser(id, { isActive: true }, correlationId);

        this.logger.logUserAction(id, 'USER_ACTIVATED', { correlationId });

        return user;
    }
}
