import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { PolicyService } from './policy.service';
import { PolicyController } from './controllers/policy.controller';
import { PolicyRepository } from './repositories/policy.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [PolicyController],
    providers: [PolicyService, PolicyRepository],
    exports: [PolicyService],
})
export class PolicyModule {}
