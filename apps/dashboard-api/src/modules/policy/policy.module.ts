import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';

// Services
import { PolicyService } from './services/policy.service';
import { GroupService } from './services/group.service';
import { ResourceService } from './services/resource.service';
import { PolicyOptionService } from './services/policy-option.service';

// Controllers
import { PolicyController } from './controllers/policy.controller';
import { GroupController } from './controllers/group.controller';
import { ResourceController } from './controllers/resource.controller';
import { PolicyOptionController } from './controllers/policy-option.controller';

// Repositories
import { PolicyRepository } from './repositories/policy.repository';
import { GroupRepository } from './repositories/group.repository';
import { ResourceRepository } from './repositories/resource.repository';
import { PolicyOptionRepository } from './repositories/policy-option.repository';

@Module({
    imports: [SharedDatabaseModule],
    controllers: [
        PolicyController,
        GroupController,
        ResourceController,
        PolicyOptionController
    ],
    providers: [
        PolicyService,
        GroupService,
        ResourceService,
        PolicyOptionService,
        PolicyRepository,
        GroupRepository,
        ResourceRepository,
        PolicyOptionRepository
    ],
    exports: [
        PolicyService,
        GroupService,
        ResourceService,
        PolicyOptionService
    ],
})
export class PolicyModule {}
