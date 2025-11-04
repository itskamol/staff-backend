import { Readable } from 'node:stream';

export interface PutObjectOptions {
    key: string;
    body: Buffer | Readable | NodeJS.ReadableStream;
    contentType?: string;
    metadata?: Record<string, string>;
}

export interface PutObjectResult {
    key: string;
    size: number;
    contentType?: string;
    metadata?: Record<string, string>;
}

export interface IFileStorageService {
    putObject(options: PutObjectOptions): Promise<PutObjectResult>;
    getObjectStream(key: string): Promise<Readable>;
    deleteObject(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    getAbsolutePath(key: string): string;
}

export const FILE_STORAGE_SERVICE = Symbol('FILE_STORAGE_SERVICE');
