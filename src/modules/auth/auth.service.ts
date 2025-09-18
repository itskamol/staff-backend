import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRepository } from '../user/user.repository';
import { CustomJwtService, JwtPayload } from './jwt.service';
import { CacheService } from '@/core/cache/cache.service';
import { PasswordUtil } from '@/shared/utils/password.util';
import { LoginDto, LoginResponseDto, RefreshTokenDto, RefreshTokenResponseDto } from '@/shared/dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly jwtService: CustomJwtService,
        private readonly cacheService: CacheService
    ) {}

    /**
     * Authenticate user with email and password
     */
    async login(loginDto: LoginDto): Promise<LoginResponseDto> {
        const { username, password } = loginDto;

        const user = await this.userRepository.findByUsername(username);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is inactive');
        }

        const isPasswordValid = await PasswordUtil.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }


        const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
            sub: String(user.id),
            username: user.username,
            role: user.role,
        };

        const tokens = this.jwtService.generateTokenPair(jwtPayload);

        return {
            ...tokens,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
            },
        };
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
        const { refreshToken } = refreshTokenDto;

        const payload = this.jwtService.verifyRefreshToken(refreshToken);

        // const tokenId = `${payload.sub}:${payload.tokenVersion}`;
        // const isDenied = await this.cacheService.isRefreshTokenDenied(tokenId);
        // if (isDenied) {
        //     throw new UnauthorizedException('Refresh token has been revoked');
        // }
        console.log(payload)
        const user = await this.userRepository.findById(+payload.sub);
        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
            sub: String(user.id),
            role: user.role,
            username: user.username,
        };

        const newTokens = this.jwtService.generateTokenPair(jwtPayload, payload.tokenVersion + 1);

        return newTokens;
    }

    /**
     * Validate user by ID (used by JWT strategy)
     */
    async validateUser(userId: number): Promise<User | null> {
        const user = await this.userRepository.findById(userId);
        if (!user || !user.isActive) {
            return null;
        }
        return user;
    }

    /**
     * Logout user by adding refresh token to denylist
     */
    async logout(refreshToken: string): Promise<void> {
        try {
            const payload = this.jwtService.verifyRefreshToken(refreshToken);
            const tokenId = `${payload.sub}:${payload.tokenVersion}`;
            await this.cacheService.denyRefreshToken(tokenId, payload.exp || 0);
        } catch {
            // Do not throw error on logout
        }
    }
}
