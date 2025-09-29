import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

export class DatabaseUtil {
    /**
     * Check if error is a unique constraint violation
     */
    static isUniqueConstraintError(error: any): boolean {
        return error instanceof PrismaClientKnownRequestError && error.code === 'P2002';
    }

    /**
     * Check if error is a record not found error
     */
    static isRecordNotFoundError(error: any): boolean {
        return error instanceof PrismaClientKnownRequestError && error.code === 'P2025';
    }

    /**
     * Extract field names from unique constraint error
     */
    static getUniqueConstraintFields(error: any): string[] {
        if (this.isUniqueConstraintError(error)) {
            return (error.meta?.target as string[]) || [];
        }
        return [];
    }
}
