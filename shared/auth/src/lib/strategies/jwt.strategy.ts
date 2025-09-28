import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../jwt.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-here-32-chars',
        });
    }

    async validate(payload: JwtPayload) {
        if (!payload.sub || !payload.username) {
            throw new UnauthorizedException('Invalid token payload');
        }

        return {
            id: payload.sub,
            username: payload.username,
            role: payload.role,
            organizationId: payload.organizationId,
        };
    }
}
