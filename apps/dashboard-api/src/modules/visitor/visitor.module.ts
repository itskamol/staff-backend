import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@staff-control-system/shared/database';
import { VisitorController } from './visitor.controller';
import { VisitorService } from './visitor.service';

@Module({
  imports: [SharedDatabaseModule],
  controllers: [VisitorController],
  providers: [VisitorService],
  exports: [VisitorService],
})
export class VisitorModule {}