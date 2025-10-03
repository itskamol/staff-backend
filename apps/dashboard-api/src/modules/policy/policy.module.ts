import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';
import { PolicyService } from './policy.service';
import { PolicyController } from './controllers/policy.controller';
import { PolicyRepository } from './repositories/policy.repository';
import { ResourceController } from './controllers/resouce.controller';
import { ResourceService } from './services/resource.service';
import { ResourceRepository } from './repositories/resource.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [PolicyController, ResourceController],
    providers: [PolicyService, PolicyRepository, ResourceService, ResourceRepository],
    exports: [PolicyService],
})
export class PolicyModule {}
