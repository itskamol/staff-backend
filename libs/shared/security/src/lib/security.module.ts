import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { CertificateService } from './certificate.service';
import { SecurityTestingService } from './security-testing.service';
import { SharedDatabaseModule } from '@shared/database';

@Module({
  imports: [SharedDatabaseModule],
  providers: [ApiKeyService, CertificateService, SecurityTestingService],
  exports: [ApiKeyService, CertificateService, SecurityTestingService],
})
export class SecurityModule {}