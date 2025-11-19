import { Module } from '@nestjs/common';
import { SharedDatabaseModule } from '@app/shared/database';

// Services
import { PolicyService } from './services/policy.service';
import { GroupService } from './services/group.service';
import { ResourceService } from './services/resource.service';

// Controllers
import { PolicyController } from './controllers/policy.controller';
import { GroupController } from './controllers/group.controller';
import { ResourceController } from './controllers/resource.controller';

// Repositories
import { PolicyRepository } from './repositories/policy.repository';
import { GroupRepository } from './repositories/group.repository';
import { ResourceRepository } from './repositories/resource.repository';
import { EmployeeModule } from '../employee/employee.module';

@Module({
    imports: [SharedDatabaseModule, EmployeeModule],
    controllers: [
        GroupController,
        ResourceController,
        PolicyController,
    ],
    providers: [
        PolicyService,
        GroupService,
        ResourceService,
        PolicyRepository,
        GroupRepository,
        ResourceRepository,
    ],
    exports: [
        PolicyService,
        GroupService,
        ResourceService,
    ],
})
export class PolicyModule {}
