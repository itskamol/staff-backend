import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export interface FormattedValidationError {
    field: string;
    value: any;
    constraints: Record<string, string>;
    message: string;
}

export class CustomValidationException extends BadRequestException {
    constructor(errors: ValidationError[]) {
        const formattedErrors: FormattedValidationError[] = errors.map(error => ({
            field: error.property,
            value: error.value,
            constraints: error.constraints || {},
            message: Object.values(error.constraints || {}).join(', '),
        }));

        const message = formattedErrors.map(err => `${err.field}: ${err.message}`).join('; ');
        console.log('Validation errors:', message);
        super({
            message: `Validation failed: ${message}`,
            errors: formattedErrors,
            statusCode: 400,
        });
    }
}