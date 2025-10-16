export interface FileMetadata {
  contentType?: string;
  size?: number;
  organizationId?: number;
  uploadedBy?: number;
  tags?: Record<string, string>;
  encryption?: {
    algorithm: string;
    keyId: string;
  };
}

export interface FileInfo {
  path: string;
  size: number;
  contentType?: string;
  lastModified: Date;
  etag?: string;
  metadata?: FileMetadata;
}

export interface ListOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
  recursive?: boolean;
}

export interface ListResult {
  files: FileInfo[];
  continuationToken?: string;
  isTruncated: boolean;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: FileMetadata;
  encrypt?: boolean;
  overwrite?: boolean;
}

export interface DownloadOptions {
  range?: {
    start: number;
    end?: number;
  };
  decrypt?: boolean;
}

export interface IFileStorageService {
  /**
   * Upload a file to storage
   */
  upload(file: Buffer, path: string, options?: UploadOptions): Promise<string>;

  /**
   * Download a file from storage
   */
  download(path: string, options?: DownloadOptions): Promise<Buffer>;

  /**
   * Delete a file from storage
   */
  delete(path: string): Promise<void>;

  /**
   * List files in storage
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * Get a presigned URL for file access
   */
  getUrl(path: string, expiresIn?: number): Promise<string>;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getMetadata(path: string): Promise<FileMetadata | null>;

  /**
   * Copy a file within storage
   */
  copy(sourcePath: string, destinationPath: string): Promise<void>;

  /**
   * Move a file within storage
   */
  move(sourcePath: string, destinationPath: string): Promise<void>;

  /**
   * Get storage statistics
   */
  getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    availableSpace?: number;
  }>;
}