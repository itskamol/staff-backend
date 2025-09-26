import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@staff-control-system/shared/database';
import { JwtService } from '@staff-control-system/shared/auth';
import { EncryptionUtil } from '@staff-control-system/shared/utils';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Find user by username
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        organization: true,
        departmentUsers: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await EncryptionUtil.comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.jwtService.generateTokens({
      sub: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
    });

    // Return user info and tokens
    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization,
        departments: user.departmentUsers.map(du => du.department),
      },
      tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const newTokens = await this.jwtService.refreshAccessToken(refreshToken);
      return newTokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: true,
        departmentUsers: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
      departmentIds: user.departmentUsers.map(du => du.departmentId),
    };
  }
}