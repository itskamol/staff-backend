import { ConfigService } from '@/core/config/config.service';
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
    private readonly algorithm = 'aes-256-cbc';
    private readonly key: Buffer;

    constructor(private readonly configService: ConfigService) {
        const keyHex = this.configService.encryptionSecretKey;
        this.key = Buffer.from(keyHex, 'hex');
    }

    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        return `${iv.toString('hex')  }:${  encrypted}`;
    }

    decrypt(encryptedText: string): string {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted text format. Expected iv:encryptedText.');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encryptedData = parts[1];

            if (iv.length !== 16) {
                throw new Error('Invalid IV length.');
            }

            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            console.log('Decryption error:', error);
            throw new Error('Failed to decrypt data.');
        }
    }

    static generateKey(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    static generateIV(): string {
        return crypto.randomBytes(16).toString('hex');
    }
}
