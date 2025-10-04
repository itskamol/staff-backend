import { Injectable } from '@nestjs/common';

export interface SanitizationResult {
    sanitized: any;
    redactedFields: string[];
}

@Injectable()
export class DataSanitizerService {
    private readonly sensitiveFields = [
        'password',
        'passwd',
        'pwd',
        'token',
        'secret',
        'key',
        'authorization',
        'cookie',
        'session',
        'credential',
        'username',
        'email',
        'pin',
        'ssn',
        'credit',
        'card',
        'cvv',
        'account',
        'medical',
        'fingerprint',
        'biometric',
    ];

    private readonly piiPatterns = [
        { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
        {
            pattern: /(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
            replacement: '[PHONE]',
        },
        { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
        { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD]' },
    ];

    /**
     * Main sanitization method
     */
    sanitize(data: any, maxDepth = 5): SanitizationResult {
        const redactedFields: string[] = [];

        const sanitizeRecursive = (obj: any, depth = 0, path = ''): any => {
            if (depth > maxDepth || obj === null || obj === undefined) {
                return obj;
            }

            // Handle primitives
            if (typeof obj !== 'object') {
                return this.sanitizePrimitive(obj, path, redactedFields);
            }

            // Handle arrays
            if (Array.isArray(obj)) {
                return obj
                    .slice(0, 100)
                    .map((item, index) => sanitizeRecursive(item, depth + 1, `${path}[${index}]`));
            }

            // Handle objects
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                const fieldPath = path ? `${path}.${key}` : key;

                if (this.isSensitiveField(key)) {
                    result[key] = this.redactValue(value);
                    redactedFields.push(fieldPath);
                } else {
                    result[key] = sanitizeRecursive(value, depth + 1, fieldPath);
                }
            }
            return result;
        };

        try {
            const sanitized = sanitizeRecursive(JSON.parse(JSON.stringify(data)));
            return { sanitized, redactedFields };
        } catch {
            // If JSON serialization fails, return safe fallback
            return { sanitized: '[COMPLEX_OBJECT]', redactedFields: ['root'] };
        }
    }

    /**
     * Quick sanitize for simple cases
     */
    sanitizeQuick(data: any): any {
        return this.sanitize(data).sanitized;
    }

    /**
     * Optimized for logging
     */
    sanitizeForLogging(data: any): any {
        return this.sanitize(data, 3).sanitized;
    }

    /**
     * For audit trails
     */
    sanitizeForAudit(data: any): SanitizationResult {
        return this.sanitize(data, 6);
    }

    private sanitizePrimitive(value: any, path: string, redactedFields: string[]): any {
        if (typeof value === 'string') {
            // Truncate long strings
            let sanitized = value.length > 500 ? `${value.substring(0, 500)}[...]` : value;

            // Remove PII patterns
            for (const { pattern, replacement } of this.piiPatterns) {
                if (pattern.test(sanitized)) {
                    sanitized = sanitized.replace(pattern, replacement);
                    redactedFields.push(`${path}:PII`);
                }
            }
            return sanitized;
        }

        // Check numeric values for potential sensitive data
        if (typeof value === 'number') {
            const numStr = value.toString();
            if (numStr.length >= 13 && numStr.length <= 19) {
                redactedFields.push(`${path}:NUMERIC`);
                return '[REDACTED_NUMBER]';
            }
        }

        return value;
    }

    private redactValue(value: any): string {
        if (value === null || value === undefined) return '[NULL]';
        if (typeof value === 'string') return `[REDACTED:${value.length}]`;
        if (typeof value === 'number') return '[REDACTED:NUM]';
        if (Array.isArray(value)) return `[REDACTED:ARRAY:${value.length}]`;
        if (typeof value === 'object') return `[REDACTED:OBJECT:${Object.keys(value).length}]`;
        return '[REDACTED]';
    }

    private isSensitiveField(fieldName: string): boolean {
        const lowerFieldName = fieldName.toLowerCase();
        return this.sensitiveFields.some(field => lowerFieldName.includes(field));
    }
}