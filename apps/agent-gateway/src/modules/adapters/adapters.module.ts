import { Module, OnModuleInit } from '@nestjs/common';
import { AdapterRegistryService } from './adapter-registry.service';
import { LoggingAdapter } from './mock/logging.adapter';

@Module({
    providers: [AdapterRegistryService],
    exports: [AdapterRegistryService],
})
export class AdaptersModule implements OnModuleInit {
    constructor(private readonly registry: AdapterRegistryService) {}

    onModuleInit(): void {
        // Register built-in adapters. Real implementations would be wired similarly.
        this.registry.registerAdapter(new LoggingAdapter());
    }
}
