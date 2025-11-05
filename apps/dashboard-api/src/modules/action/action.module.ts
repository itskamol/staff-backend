// ...existing code...
import { Module } from '@nestjs/common';
import { ActionService } from './service/action.service';
import { ActionRepository } from './repositories/action.repository';
import { ActionController } from './controller/action.controller';

@Module({
  controllers: [ActionController],
  providers: [ActionService, ActionRepository],
  exports: [ActionService],
})
export class ActionModule {}