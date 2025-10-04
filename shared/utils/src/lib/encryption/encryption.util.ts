import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

export class EncryptionUtil {
    private static readonly SALT_ROUNDS = 12;

    /**
     * Hash a password with bcrypt
     */
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    /**
     * Alias for hashPassword for backward compatibility
     */
    static async hash(password: string): Promise<string> {
        return this.hashPassword(password);
    }

    /**
     * Compare a plain password with a hashed password
     */
    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Alias for comparePassword for backward compatibility
     */
    static async compare(password: string, hashedPassword: string): Promise<boolean> {
        return this.comparePassword(password, hashedPassword);
    }

    /**
     * Validate password strength
     */
    static validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[@$!%*#?&]/.test(password)) {
            errors.push('Password must contain at least one special character (@$!%*?&)');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Generate API key
     */
    static generateApiKey(): string {
        return randomBytes(32).toString('hex');
    }

    /**
     * Hash API key
     */
    static hashApiKey(apiKey: string): string {
        return createHash('sha256').update(apiKey).digest('hex');
    }

    /**
     * Encrypt data with optional key
     */
    static encrypt(data: string, key?: string): string {
        const secretKey = key || process.env['ENCRYPTION_KEY'] || 'default-secret-key';
        return createHash('sha256')
            .update(data + secretKey)
            .digest('hex');
    }

    /**
     * Generate UUID
     */
    static generateUUID(): string {
        return randomBytes(16)
            .toString('hex')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }
}

// Export as PasswordUtil for backward compatibility
export const PasswordUtil = EncryptionUtil;
