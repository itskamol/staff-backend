import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';

export interface JwtPayload {
    sub: number;
    username: string;
    role: string;
    organizationId?: number;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtService {
    constructor(private readonly jwtService: NestJwtService) {}

    async generateTokens(payload: Omit<JwtPayload, 'iat' | 'exp'>) {
        const accessToken = this.jwtService.sign(payload, {
            expiresIn: '15m',
        });

        const refreshToken = this.jwtService.sign(payload, {
            expiresIn: '7d',
        });

        return {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: 900, // 15 minutes
        };
    }

    async verifyToken(token: string): Promise<JwtPayload> {
        return this.jwtService.verify(token);
    }

    async refreshAccessToken(refreshToken: string) {
        const payload = await this.verifyToken(refreshToken);
        const { iat, exp, ...userPayload } = payload;

        return this.generateTokens(userPayload);
    }
}
