import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@staff-control-system/shared/database';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}