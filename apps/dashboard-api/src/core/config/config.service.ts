import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  url: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshSecret: string;
  refreshExpiresIn: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface AppConfig {
  port: number;
  environment: string;
  apiPrefix: string;
  corsOrigins: string[];
  maxFileSize: number;
  uploadPath: string;
}

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: NestConfigService) {}

  get app(): AppConfig {
    return {
      port: this.configService.get<number>('PORT', 3000),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      apiPrefix: this.configService.get<string>('API_PREFIX', 'api'),
      corsOrigins: this.configService
        .get<string>('CORS_ORIGINS', '*')
        .split(','),
      maxFileSize: this.configService.get<number>(
        'MAX_FILE_SIZE',
        10 * 1024 * 1024
      ), // 10MB
      uploadPath: this.configService.get<string>('UPLOAD_PATH', './uploads'),
    };
  }

  get database(): DatabaseConfig {
    const url = this.configService.get<string>('DATABASE_URL');

    if (url) {
      const parsed = new URL(url);
      return {
        url,
        host: parsed.hostname,
        port: parseInt(parsed.port) || 5432,
        username: parsed.username,
        password: parsed.password,
        database: parsed.pathname.slice(1),
      };
    }

    return {
      url: '',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', ''),
      database: this.configService.get<string>('DB_DATABASE', 'staff_control'),
    };
  }

  get jwt(): JwtConfig {
    return {
      secret: this.configService.get<string>('JWT_SECRET', 'your-secret-key'),
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1d'),
      refreshSecret: this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'your-refresh-secret'
      ),
      refreshExpiresIn: this.configService.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d'
      ),
    };
  }

  get redis(): RedisConfig {
    return {
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      db: this.configService.get<number>('REDIS_DB', 0),
    };
  }

  get isDevelopment(): boolean {
    return this.app.environment === 'development';
  }

  get isProduction(): boolean {
    return this.app.environment === 'production';
  }

  get isTest(): boolean {
    return this.app.environment === 'test';
  }
}
