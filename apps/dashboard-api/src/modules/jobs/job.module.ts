import { Module } from '@nestjs/common';
import { SharedCommonModule } from '@app/shared/common';
import { JobController } from './controller/job.controller';
import { JobRepository } from './repositories/job.repository';
import { JobService } from './service/job.service';

@Module({
    imports: [SharedCommonModule],
    controllers: [JobController],
    providers: [JobRepository, JobService],
    exports: [JobService, JobRepository],
})
export class JobModule {}
