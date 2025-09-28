export class ApiResponseDto<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    timestamp: Date;

    constructor(success: boolean, data?: T, message?: string, error?: any) {
        this.success = success;
        this.data = data;
        this.message = message;
        this.error = error;
        this.timestamp = new Date();
    }

    static success<T>(data?: T, message?: string): ApiResponseDto<T> {
        return new ApiResponseDto(true, data, message);
    }

    static error(code: string, message: string, details?: any): ApiResponseDto {
        return new ApiResponseDto(false, undefined, undefined, {
            code,
            message,
            details,
        });
    }
}
