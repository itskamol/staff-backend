import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomJwtService } from './jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule, UserModule],
    controllers: [AuthController],
    providers: [AuthService, CustomJwtService, JwtStrategy],
    exports: [AuthService, CustomJwtService, PassportModule],
})
export class AuthModule {}
