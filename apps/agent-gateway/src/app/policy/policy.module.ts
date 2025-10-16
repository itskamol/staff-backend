import { Module } from '@nestjs/common';
import { PolicyVersioningService } from './policy-versioning.service';
import { PolicyDistributionService } from './policy-distribution.service';
import { PolicyComparisonService } from './policy-comparison.service';
import { PolicyAuditService } from './policy-audit.service';
import { ControlChannelModule } from '../control-channel/control-channel.module';

@Module({
  imports: [ControlChannelModule],
  providers: [
    PolicyVersioningService,
    PolicyDistributionService,
    PolicyComparisonService,
    PolicyAuditService,
  ],
  exports: [
    PolicyVersioningService,
    PolicyDistributionService,
    PolicyComparisonService,
    PolicyAuditService,
  ],
})
export class PolicyModule {}