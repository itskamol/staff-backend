import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../jwt.service';
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { ConfigService } from 'apps/dashboard-api/src/core/config/config.service';
import { UserContext } from 'apps/dashboard-api/src/shared/interfaces';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        private readonly logger: LoggerService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.jwtSecret,
        });
    }

    async validate(payload: JwtPayload): Promise<UserContext> {
        try {
            // Basic payload validation
            if (!payload.sub || !payload.username) {
                this.logger.warn('Invalid JWT payload: missing required fields', {
                    hasUserId: !!payload.sub,
                    hasUsername: !!payload.username,
                    module: 'jwt-strategy',
                });
                throw new UnauthorizedException('Invalid token payload');
            }

            // Extract user context
            const userContext: UserContext = {
                sub: payload.sub,
                role: payload.role,
                username: payload.username,
                ...(payload?.organizationId ? { organizationId: payload.organizationId } : {}),
                ...(payload?.departments?.length ? { departments: payload.departments } : {}),
            };

            this.logger.debug('JWT validation successful', {
                userId: userContext.sub,
                module: 'jwt-strategy',
            });

            return userContext;
        } catch (error) {
            this.logger.error('JWT validation failed', error.message, {
                module: 'jwt-strategy',
                error: error.message,
            });
            throw new UnauthorizedException('Token validation failed');
        }
    }
}
