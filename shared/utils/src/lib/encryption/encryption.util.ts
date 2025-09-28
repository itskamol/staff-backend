import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

export class EncryptionUtil {
    private static readonly SALT_ROUNDS = 12;

    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, this.SALT_ROUNDS);
    }

    static async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    static generateApiKey(): string {
        return randomBytes(32).toString('hex');
    }

    static hashApiKey(apiKey: string): string {
        return createHash('sha256').update(apiKey).digest('hex');
    }

    static encrypt(data: string, key?: string): string {
        const secretKey = key || process.env['ENCRYPTION_KEY'] || 'default-secret-key';
        return createHash('sha256')
            .update(data + secretKey)
            .digest('hex');
    }

    static generateUUID(): string {
        return randomBytes(16)
            .toString('hex')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }
}
