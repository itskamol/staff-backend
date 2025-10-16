import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface SessionContext {
  organizationId: number;
  role: string;
  userId?: number;
  requestId?: string;
}

export interface RLSAuditLog {
  id: string;
  action: string;
  userId?: number;
  organizationId?: number;
  resource: string;
  policyName: string;
  accessGranted: boolean;
  reason?: string;
  timestamp: Date;
  requestId?: string;
}

@Injectable()
export class RLSSessionService {
  private readonly logger = new Logger(RLSSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async setSessionContext(context: SessionContext): Promise<void> {
    try {
      // Set PostgreSQL session variables for RLS
      await this.prisma.$executeRaw`
        SELECT set_config('app.current_organization_id', ${context.organizationId.toString()}, true)
      `;

      await this.prisma.$executeRaw`
        SELECT set_config('app.current_role', ${context.role}, true)
      `;

      if (context.userId) {
        await this.prisma.$executeRaw`
          SELECT set_config('app.current_user_id', ${context.userId.toString()}, true)
        `;
      }

      if (context.requestId) {
        await this.prisma.$executeRaw`
          SELECT set_config('app.current_request_id', ${context.requestId}, true)
        `;
      }

      this.logger.debug(`Session context set: org=${context.organizationId}, role=${context.role}`);
    } catch (error) {
      this.logger.error(`Failed to set session context: ${error.message}`);
      throw error;
    }
  }

  async clearSessionContext(): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        SELECT set_config('app.current_organization_id', NULL, true)
      `;

      await this.prisma.$executeRaw`
        SELECT set_config('app.current_role', NULL, true)
      `;

      await this.prisma.$executeRaw`
        SELECT set_config('app.current_user_id', NULL, true)
      `;

      await this.prisma.$executeRaw`
        SELECT set_config('app.current_request_id', NULL, true)
      `;

      this.logger.debug('Session context cleared');
    } catch (error) {
      this.logger.error(`Failed to clear session context: ${error.message}`);
    }
  }

  async getCurrentContext(): Promise<SessionContext | null> {
    try {
      const result = await this.prisma.$queryRaw<Array<{
        organization_id: string;
        role: string;
        user_id: string;
        request_id: string;
      }>>`
        SELECT 
          current_setting('app.current_organization_id', true) as organization_id,
          current_setting('app.current_role', true) as role,
          current_setting('app.current_user_id', true) as user_id,
          current_setting('app.current_request_id', true) as request_id
      `;

      const row = result[0];
      if (!row || !row.organization_id || !row.role) {
        return null;
      }

      return {
        organizationId: parseInt(row.organization_id),
        role: row.role,
        userId: row.user_id ? parseInt(row.user_id) : undefined,
        requestId: row.request_id || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get current context: ${error.message}`);
      return null;
    }
  }

  async logRLSAccess(logData: Omit<RLSAuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      await this.prisma.rlsAuditLog.create({
        data: {
          action: logData.action,
          userId: logData.userId,
          organizationId: logData.organizationId,
          resource: logData.resource,
          policyName: logData.policyName,
          accessGranted: logData.accessGranted,
          reason: logData.reason,
          requestId: logData.requestId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log RLS access: ${error.message}`);
      // Don't throw here to avoid breaking the main request
    }
  }
}