import { Module } from '@nestjs/common';
import { AdapterRegistryService } from './adapter-registry.service';
import { AdapterConfigurationService } from './adapter-configuration.service';
import { AdapterLifecycleService } from './adapter-lifecycle.service';
import { AdapterHealthService } from './adapter-health.service';

@Module({
  providers: [
    AdapterRegistryService,
    AdapterConfigurationService,
    AdapterLifecycleService,
    AdapterHealthService,
  ],
  exports: [
    AdapterRegistryService,
    AdapterConfigurationService,
    AdapterLifecycleService,
    AdapterHealthService,
  ],
})
export class AdapterModule {}