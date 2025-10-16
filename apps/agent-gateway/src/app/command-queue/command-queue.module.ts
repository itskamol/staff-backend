import { Module } from '@nestjs/common';
import { CommandQueueInfrastructureService } from './command-queue-infrastructure.service';
import { CommandProcessingEngineService } from './command-processing-engine.service';
import { QueueManagementService } from './queue-management.service';
import { CommandValidationService } from './command-validation.service';
import { CommandExecutorService } from './command-executor.service';

@Module({
  providers: [
    CommandQueueInfrastructureService,
    CommandProcessingEngineService,
    QueueManagementService,
    CommandValidationService,
    CommandExecutorService,
  ],
  exports: [
    CommandQueueInfrastructureService,
    CommandProcessingEngineService,
    QueueManagementService,
    CommandValidationService,
    CommandExecutorService,
  ],
})
export class CommandQueueModule {}