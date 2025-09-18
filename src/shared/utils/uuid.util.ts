import { validate as uuidValidate, v4 as uuidv4 } from 'uuid';

export class UuidUtil {
    /**
     * Generate a new UUID v4
     */
    static generate(): string {
        return uuidv4();
    }

    /**
     * Validate if a string is a valid UUID
     */
    static isValid(uuid: string): boolean {
        return uuidValidate(uuid);
    }

    /**
     * Generate a short UUID for display purposes (first 8 characters)
     */
    static generateShort(): string {
        return uuidv4().substring(0, 8);
    }
}
