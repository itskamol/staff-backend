import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { GatewayConfigService } from '../../config/gateway-config.service';
import { BufferEnqueueItem, BufferedRecord, BufferSnapshot } from './interfaces';

interface PersistedQueue {
    version: number;
    updatedAt: string;
    records: BufferedRecord[];
}

@Injectable()
export class GatewayBufferService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(GatewayBufferService.name);
    private readonly storageDirectory: string;
    private readonly storageFile: string;
    private queue: BufferedRecord[] = [];
    private lastPersistedAt?: string;
    private queueMutex: Promise<void> = Promise.resolve();
    private destroyed = false;

    constructor(private readonly config: GatewayConfigService) {
        this.storageDirectory = this.config.bufferDirectory;
        this.storageFile = path.join(this.storageDirectory, 'queue.json');
    }

    async onModuleInit(): Promise<void> {
        await mkdir(this.storageDirectory, { recursive: true });
        await this.loadFromDisk();
    }

    async onModuleDestroy(): Promise<void> {
        this.destroyed = true;
        await this.withLock(async () => {
            await this.persist();
        });
    }

    get size(): number {
        return this.queue.length;
    }

    async enqueueBatch(
        channel: string,
        items: BufferEnqueueItem[],
        context?: Record<string, unknown>
    ): Promise<BufferedRecord[]> {
        if (!items.length) {
            return [];
        }

        return this.withLock(async () => {
            const projectedSize = this.queue.length + items.length;
            if (projectedSize > this.config.maxQueueSize) {
                this.logger.warn(
                    `Queue capacity would be exceeded: ${projectedSize}/${this.config.maxQueueSize}`
                );
                throw new ServiceUnavailableException('Gateway buffer is at capacity');
            }

            const now = new Date();
            const records = items.map<BufferedRecord>(item => ({
                ...item,
                id: randomUUID(),
                channel,
                context,
                attempts: 0,
                enqueuedAt: now.toISOString(),
            }));

            this.queue.push(...records);
            await this.persist();
            return records;
        });
    }

    async drain(maxItems: number): Promise<BufferedRecord[]> {
        if (maxItems <= 0) {
            return [];
        }

        return this.withLock(async () => {
            const items = this.queue.splice(0, maxItems);
            if (items.length > 0) {
                await this.persist();
            }
            return items;
        });
    }

    async requeue(items: BufferedRecord[]): Promise<void> {
        if (!items.length) return;

        await this.withLock(async () => {
            // push failed items back to the front and increment attempt counter
            for (let i = items.length - 1; i >= 0; i -= 1) {
                const item = { ...items[i], attempts: items[i].attempts + 1 };
                this.queue.unshift(item);
            }
            await this.persist();
        });
    }

    async getSnapshot(): Promise<BufferSnapshot> {
        const snapshot: BufferSnapshot = {
            size: this.queue.length,
            capacity: this.config.maxQueueSize,
            storagePath: this.storageFile,
            lastPersistedAt: this.lastPersistedAt,
            oldestRecordAt: this.queue[0]?.enqueuedAt,
        };

        try {
            const fileStat = await stat(this.storageFile);
            snapshot.diskUsageBytes = fileStat.size;
        } catch {
            // ignore if file does not exist yet
        }

        return snapshot;
    }

    private async loadFromDisk(): Promise<void> {
        try {
            const raw = await readFile(this.storageFile, 'utf-8');
            const parsed = JSON.parse(raw) as PersistedQueue;
            if (Array.isArray(parsed.records)) {
                this.queue = parsed.records;
                this.lastPersistedAt = parsed.updatedAt;
                this.logger.log(`Loaded ${this.queue.length} buffered records from disk`);
            }
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                this.logger.error('Failed to load persisted buffer, starting with empty queue', error);
            }
        }
    }

    private async persist(): Promise<void> {
        const payload: PersistedQueue = {
            version: 1,
            updatedAt: new Date().toISOString(),
            records: this.queue,
        };

        const tempFile = `${this.storageFile}.tmp`;
        await writeFile(tempFile, JSON.stringify(payload, null, 2), 'utf-8');
        await rename(tempFile, this.storageFile);
        this.lastPersistedAt = payload.updatedAt;

        if (!this.destroyed) {
            this.logger.debug(`Persisted ${this.queue.length} records to ${this.storageFile}`);
        }
    }

    private async withLock<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.queueMutex.then(operation, operation);
        this.queueMutex = run.then(
            () => undefined,
            () => undefined
        );
        return run;
    }
}
