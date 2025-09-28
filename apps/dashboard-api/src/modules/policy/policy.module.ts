import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [PolicyController],
    providers: [PolicyService],
    exports: [PolicyService],
})
export class PolicyModule {}
