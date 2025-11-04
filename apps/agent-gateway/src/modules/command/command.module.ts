import { Module } from '@nestjs/common';
import { CommandExecutorService } from './command-executor.service';
import { AdaptersModule } from '../adapters/adapters.module';

@Module({
    imports: [AdaptersModule],
    providers: [CommandExecutorService],
    exports: [CommandExecutorService],
})
export class CommandModule {}
