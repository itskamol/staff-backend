import { Injectable, Logger } from '@nestjs/common';
import { DeviceAdapter } from './device-adapter.interface';

@Injectable()
export class AdapterRegistryService {
    private readonly logger = new Logger(AdapterRegistryService.name);
    private readonly adapters = new Map<string, DeviceAdapter>();

    registerAdapter(adapter: DeviceAdapter): void {
        const key = this.buildKey(adapter.type, adapter.vendor);
        if (this.adapters.has(key)) {
            this.logger.warn(`Adapter ${key} already registered. Overwriting previous instance.`);
        }
        this.adapters.set(key, adapter);
        this.logger.log(`Registered adapter ${key}`);
    }

    getAdapter(type: string, vendor: string): DeviceAdapter | undefined {
        return this.adapters.get(this.buildKey(type, vendor));
    }

    listAdapters(): DeviceAdapter[] {
        return Array.from(this.adapters.values());
    }

    private buildKey(type: string, vendor: string): string {
        return `${type.toLowerCase()}::${vendor.toLowerCase()}`;
    }
}
