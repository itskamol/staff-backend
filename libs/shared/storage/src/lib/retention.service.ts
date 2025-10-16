import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/database';
import { IFileStorageService } from './file-storage.interface';
import { FileStorageFactory } from './file-storage.factory';

export interface RetentionPolicy {
  id: string;
  organizationId?: number;
  resourceType: string;
  retentionDays: number;
  action: 'delete' | 'archive';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionJob {
  id: string;
  policyId: string;
  filePath: string;
  action: 'delete' | 'archive';
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  processedAt?: Date;
}

export interface RetentionReport {
  policyId: string;
  resourceType: string;
  totalFiles: number;
  processedFiles: number;
  deletedFiles: number;
  archivedFiles: number;
  failedFiles: number;
  spaceSaved: number;
  errors: string[];
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly storageFactory: FileStorageFactory,
  ) {}

  async createRetentionPolicy(policy: Omit<RetentionPolicy, 'id' | 'createdAt' | 'updatedAt'>): Promise<RetentionPolicy> {
    try {
      const created = await this.prisma.retentionPolicy.create({
        data: {
          organizationId: policy.organizationId,
          resourceType: policy.resourceType,
          retentionDays: policy.retentionDays,
          action: policy.action,
          isActive: policy.isActive,
        },
      });

      this.logger.log(`Created retention policy: ${created.id} for ${policy.resourceType}`);

      return {
        id: created.id,
        organizationId: created.organizationId,
        resourceType: created.resourceType,
        retentionDays: created.retentionDays,
        action: created.action as 'delete' | 'archive',
        isActive: created.isActive,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to create retention policy: ${error.message}`);
      throw error;
    }
  }

  async getRetentionPolicies(organizationId?: number): Promise<RetentionPolicy[]> {
    const policies = await this.prisma.retentionPolicy.findMany({
      where: organizationId ? { organizationId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return policies.map(p => ({
      id: p.id,
      organizationId: p.organizationId,
      resourceType: p.resourceType,
      retentionDays: p.retentionDays,
      action: p.action as 'delete' | 'archive',
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async updateRetentionPolicy(id: string, updates: Partial<RetentionPolicy>): Promise<RetentionPolicy> {
    try {
      const updated = await this.prisma.retentionPolicy.update({
        where: { id },
        data: {
          resourceType: updates.resourceType,
          retentionDays: updates.retentionDays,
          action: updates.action,
          isActive: updates.isActive,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Updated retention policy: ${id}`);

      return {
        id: updated.id,
        organizationId: updated.organizationId,
        resourceType: updated.resourceType,
        retentionDays: updated.retentionDays,
        action: updated.action as 'delete' | 'archive',
        isActive: updated.isActive,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to update retention policy ${id}: ${error.message}`);
      throw error;
    }
  }

  async deleteRetentionPolicy(id: string): Promise<void> {
    try {
      await this.prisma.retentionPolicy.delete({
        where: { id },
      });

      this.logger.log(`Deleted retention policy: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete retention policy ${id}: ${error.message}`);
      throw error;
    }
  }

  async scanForExpiredFiles(): Promise<RetentionJob[]> {
    this.logger.log('Starting scan for expired files');

    const activePolicies = await this.getRetentionPolicies();
    const jobs: RetentionJob[] = [];

    for (const policy of activePolicies.filter(p => p.isActive)) {
      const expiredFiles = await this.findExpiredFiles(policy);
      
      for (const filePath of expiredFiles) {
        const job: RetentionJob = {
          id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          policyId: policy.id,
          filePath,
          action: policy.action,
          scheduledFor: new Date(),
          status: 'pending',
        };

        jobs.push(job);
      }
    }

    // Store jobs in database
    for (const job of jobs) {
      await this.prisma.retentionJob.create({
        data: {
          id: job.id,
          policyId: job.policyId,
          filePath: job.filePath,
          action: job.action,
          scheduledFor: job.scheduledFor,
          status: job.status,
        },
      });
    }

    this.logger.log(`Created ${jobs.length} retention jobs`);
    return jobs;
  }

  private async findExpiredFiles(policy: RetentionPolicy): Promise<string[]> {
    const storage = this.storageFactory.create();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    const expiredFiles: string[] = [];

    try {
      // List files with the resource type prefix
      const listResult = await storage.list({
        prefix: policy.resourceType,
        recursive: true,
      });

      for (const file of listResult.files) {
        // Check if file is older than retention period
        if (file.lastModified < cutoffDate) {
          // Additional organization filtering if specified
          if (policy.organizationId) {
            const metadata = await storage.getMetadata(file.path);
            if (metadata?.organizationId !== policy.organizationId) {
              continue;
            }
          }

          expiredFiles.push(file.path);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to find expired files for policy ${policy.id}: ${error.message}`);
    }

    this.logger.debug(`Found ${expiredFiles.length} expired files for policy ${policy.id}`);
    return expiredFiles;
  }

  async processRetentionJobs(batchSize: number = 100): Promise<RetentionReport[]> {
    this.logger.log('Starting retention job processing');

    const pendingJobs = await this.prisma.retentionJob.findMany({
      where: { status: 'pending' },
      take: batchSize,
      orderBy: { scheduledFor: 'asc' },
    });

    if (pendingJobs.length === 0) {
      this.logger.log('No pending retention jobs found');
      return [];
    }

    // Group jobs by policy for reporting
    const jobsByPolicy = new Map<string, typeof pendingJobs>();
    for (const job of pendingJobs) {
      if (!jobsByPolicy.has(job.policyId)) {
        jobsByPolicy.set(job.policyId, []);
      }
      jobsByPolicy.get(job.policyId)!.push(job);
    }

    const reports: RetentionReport[] = [];

    for (const [policyId, jobs] of jobsByPolicy) {
      const report = await this.processJobsForPolicy(policyId, jobs);
      reports.push(report);
    }

    this.logger.log(`Processed ${pendingJobs.length} retention jobs across ${reports.length} policies`);
    return reports;
  }

  private async processJobsForPolicy(policyId: string, jobs: any[]): Promise<RetentionReport> {
    const policy = await this.prisma.retentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new Error(`Retention policy not found: ${policyId}`);
    }

    const report: RetentionReport = {
      policyId,
      resourceType: policy.resourceType,
      totalFiles: jobs.length,
      processedFiles: 0,
      deletedFiles: 0,
      archivedFiles: 0,
      failedFiles: 0,
      spaceSaved: 0,
      errors: [],
    };

    const storage = this.storageFactory.create();

    for (const job of jobs) {
      try {
        // Mark job as processing
        await this.prisma.retentionJob.update({
          where: { id: job.id },
          data: { status: 'processing' },
        });

        // Get file size before processing
        const fileExists = await storage.exists(job.filePath);
        if (!fileExists) {
          // File already deleted, mark as completed
          await this.prisma.retentionJob.update({
            where: { id: job.id },
            data: { 
              status: 'completed',
              processedAt: new Date(),
            },
          });
          report.processedFiles++;
          continue;
        }

        const metadata = await storage.getMetadata(job.filePath);
        const fileSize = metadata?.size || 0;

        if (job.action === 'delete') {
          await storage.delete(job.filePath);
          report.deletedFiles++;
          report.spaceSaved += fileSize;
        } else if (job.action === 'archive') {
          await this.archiveFile(storage, job.filePath);
          report.archivedFiles++;
        }

        // Mark job as completed
        await this.prisma.retentionJob.update({
          where: { id: job.id },
          data: { 
            status: 'completed',
            processedAt: new Date(),
          },
        });

        report.processedFiles++;

        this.logger.debug(`Processed retention job: ${job.id} (${job.action} ${job.filePath})`);
      } catch (error) {
        // Mark job as failed
        await this.prisma.retentionJob.update({
          where: { id: job.id },
          data: { 
            status: 'failed',
            error: error.message,
            processedAt: new Date(),
          },
        });

        report.failedFiles++;
        report.errors.push(`${job.filePath}: ${error.message}`);

        this.logger.error(`Failed to process retention job ${job.id}: ${error.message}`);
      }
    }

    return report;
  }

  private async archiveFile(storage: IFileStorageService, filePath: string): Promise<void> {
    // Move file to archive location
    const archivePath = `archive/${new Date().getFullYear()}/${filePath}`;
    
    try {
      await storage.move(filePath, archivePath);
      this.logger.debug(`Archived file: ${filePath} -> ${archivePath}`);
    } catch (error) {
      // If move fails, try copy and delete
      await storage.copy(filePath, archivePath);
      await storage.delete(filePath);
      this.logger.debug(`Archived file (copy+delete): ${filePath} -> ${archivePath}`);
    }
  }

  async getRetentionReport(policyId?: string, days: number = 30): Promise<RetentionReport[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      processedAt: { gte: startDate },
    };

    if (policyId) {
      where.policyId = policyId;
    }

    const jobs = await this.prisma.retentionJob.findMany({
      where,
      include: {
        policy: true,
      },
    });

    // Group by policy and generate reports
    const reportMap = new Map<string, RetentionReport>();

    for (const job of jobs) {
      if (!reportMap.has(job.policyId)) {
        reportMap.set(job.policyId, {
          policyId: job.policyId,
          resourceType: job.policy.resourceType,
          totalFiles: 0,
          processedFiles: 0,
          deletedFiles: 0,
          archivedFiles: 0,
          failedFiles: 0,
          spaceSaved: 0,
          errors: [],
        });
      }

      const report = reportMap.get(job.policyId)!;
      report.totalFiles++;

      if (job.status === 'completed') {
        report.processedFiles++;
        if (job.action === 'delete') {
          report.deletedFiles++;
        } else if (job.action === 'archive') {
          report.archivedFiles++;
        }
      } else if (job.status === 'failed') {
        report.failedFiles++;
        if (job.error) {
          report.errors.push(`${job.filePath}: ${job.error}`);
        }
      }
    }

    return Array.from(reportMap.values());
  }

  async scheduleRetentionCleanup(): Promise<void> {
    this.logger.log('Starting scheduled retention cleanup');

    try {
      // Scan for expired files
      await this.scanForExpiredFiles();

      // Process retention jobs
      const reports = await this.processRetentionJobs();

      // Log summary
      const totalProcessed = reports.reduce((sum, r) => sum + r.processedFiles, 0);
      const totalDeleted = reports.reduce((sum, r) => sum + r.deletedFiles, 0);
      const totalArchived = reports.reduce((sum, r) => sum + r.archivedFiles, 0);
      const totalSpaceSaved = reports.reduce((sum, r) => sum + r.spaceSaved, 0);

      this.logger.log(`Retention cleanup completed: ${totalProcessed} files processed, ${totalDeleted} deleted, ${totalArchived} archived, ${this.formatBytes(totalSpaceSaved)} space saved`);
    } catch (error) {
      this.logger.error(`Scheduled retention cleanup failed: ${error.message}`);
      throw error;
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async validateRetentionCompliance(organizationId?: number): Promise<{
    compliant: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const policies = await this.getRetentionPolicies(organizationId);

      if (policies.length === 0) {
        issues.push('No retention policies defined');
        recommendations.push('Create retention policies for different resource types');
      }

      // Check for common resource types
      const resourceTypes = ['screenshot', 'credential', 'profile', 'log'];
      const definedTypes = new Set(policies.map(p => p.resourceType));

      for (const type of resourceTypes) {
        if (!definedTypes.has(type)) {
          recommendations.push(`Consider creating retention policy for ${type} resources`);
        }
      }

      // Check for inactive policies
      const inactivePolicies = policies.filter(p => !p.isActive);
      if (inactivePolicies.length > 0) {
        issues.push(`${inactivePolicies.length} retention policies are inactive`);
      }

      // Check for failed jobs
      const failedJobs = await this.prisma.retentionJob.count({
        where: { status: 'failed' },
      });

      if (failedJobs > 0) {
        issues.push(`${failedJobs} retention jobs have failed`);
        recommendations.push('Review and retry failed retention jobs');
      }

      return {
        compliant: issues.length === 0,
        issues,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Retention compliance validation failed: ${error.message}`);
      return {
        compliant: false,
        issues: [`Validation failed: ${error.message}`],
        recommendations: ['Fix validation errors and retry'],
      };
    }
  }
}