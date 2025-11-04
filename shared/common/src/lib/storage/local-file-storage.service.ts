import { Injectable, Logger } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { IFileStorageService, PutObjectOptions, PutObjectResult } from './file-storage.interface';

@Injectable()
export class LocalFileStorageService implements IFileStorageService {
    private readonly logger = new Logger(LocalFileStorageService.name);

    constructor(private readonly basePath: string) {}

    async putObject(options: PutObjectOptions): Promise<PutObjectResult> {
        const { key, body, contentType, metadata } = options;

        if (!key) {
            throw new Error('Storage key is required');
        }

        const targetPath = this.getAbsolutePath(key);
        const directory = path.dirname(targetPath);
        await mkdir(directory, { recursive: true });

        if (Buffer.isBuffer(body)) {
            await writeFile(targetPath, body);
        } else {
            const stream = body instanceof Readable ? body : Readable.from(body);
            await pipeline(stream, createWriteStream(targetPath));
        }

        const fileStat = await stat(targetPath);

        this.logger.debug(`Stored object ${key} (${fileStat.size} bytes)`);

        return {
            key,
            size: fileStat.size,
            contentType,
            metadata,
        };
    }

    async getObjectStream(key: string): Promise<Readable> {
        const filePath = this.getAbsolutePath(key);
        return createReadStream(filePath);
    }

    async deleteObject(key: string): Promise<void> {
        const filePath = this.getAbsolutePath(key);
        try {
            await unlink(filePath);
            this.logger.debug(`Deleted object ${key}`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
    }

    async exists(key: string): Promise<boolean> {
        const filePath = this.getAbsolutePath(key);
        try {
            await stat(filePath);
            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    getAbsolutePath(key: string): string {
        const sanitizedKey = key.replace(/^\/*/, '');
        return path.resolve(this.basePath, sanitizedKey);
    }
}
