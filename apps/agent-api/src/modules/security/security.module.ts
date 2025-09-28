import { Module, Global } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';

@Global()
@Module({
    imports: [SharedDatabaseModule],
    controllers: [SecurityController],
    providers: [SecurityService, ApiKeyGuard, RateLimitGuard, IpWhitelistGuard],
    exports: [SecurityService, ApiKeyGuard, RateLimitGuard, IpWhitelistGuard],
})
export class SecurityModule {}
