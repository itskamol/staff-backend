import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { VisitorService } from './services/visitor.service';
import { VisitorController } from './controllers/visitor.controller';
import { VisitorRepository } from './repositories/visitor.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [VisitorController],
    providers: [VisitorService, VisitorRepository],
    exports: [VisitorService],
})
export class VisitorModule {}