import { BadRequestException } from '@nestjs/common';

export class ValidationUtil {
    static validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static validatePhone(phone: string): boolean {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    }

    static validatePassword(password: string): boolean {
        // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }

    static validateAgentData(data: any): boolean {
        if (!data || typeof data !== 'object') {
            throw new BadRequestException('Invalid data format');
        }

        if (!data.computerUid || typeof data.computerUid !== 'string') {
            throw new BadRequestException('Computer UID is required');
        }

        if (!data.userSid || typeof data.userSid !== 'string') {
            throw new BadRequestException('User SID is required');
        }

        if (!data.timestamp || !Date.parse(data.timestamp)) {
            throw new BadRequestException('Valid timestamp is required');
        }

        return true;
    }

    static validateHikvisionData(data: any): boolean {
        if (!data || typeof data !== 'object') {
            throw new BadRequestException('Invalid HIKVision data format');
        }

        if (!data.deviceId || typeof data.deviceId !== 'number') {
            throw new BadRequestException('Device ID is required');
        }

        if (!data.actionType || typeof data.actionType !== 'string') {
            throw new BadRequestException('Action type is required');
        }

        if (!data.actionTime || !Date.parse(data.actionTime)) {
            throw new BadRequestException('Valid action time is required');
        }

        return true;
    }
}
