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

  async validateRLSAccess(
    resource: string,
    action: string,
    context: SessionContext,
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      // Check if ADMIN role has global access
      if (context.role === 'ADMIN') {
        await this.logRLSAccess({
          action,
          userId: context.userId,
          organizationId: context.organizationId,
          resource,
          policyName: 'admin_global_access',
          accessGranted: true,
          requestId: context.requestId,
        });

        return { allowed: true };
      }

      // For non-admin roles, check organization-specific access
      const hasAccess = await this.checkOrganizationAccess(resource, context);

      await this.logRLSAccess({
        action,
        userId: context.userId,
        organizationId: context.organizationId,
        resource,
        policyName: 'organization_rls',
        accessGranted: hasAccess,
        reason: hasAccess ? undefined : 'Organization access denied',
        requestId: context.requestId,
      });

      return {
        allowed: hasAccess,
        reason: hasAccess ? undefined : 'Access denied by RLS policy',
      };
    } catch (error) {
      this.logger.error(`RLS validation failed: ${error.message}`);
      
      await this.logRLSAccess({
        action,
        userId: context.userId,
        organizationId: context.organizationId,
        resource,
        policyName: 'error',
        accessGranted: false,
        reason: `Validation error: ${error.message}`,
        requestId: context.requestId,
      });

      return { allowed: false, reason: 'Access validation failed' };
    }
  }

  private async checkOrganizationAccess(resource: string, context: SessionContext): Promise<boolean> {
    // This is a simplified check - in practice, you'd have more complex logic
    // based on the specific resource and user permissions
    
    try {
      // Test query to see if RLS allows access
      const testQuery = this.buildTestQuery(resource, context);
      const result = await this.prisma.$queryRaw(testQuery);
      
      return Array.isArray(result) && result.length >= 0; // Access allowed if query succeeds
    } catch (error) {
      // If query fails due to RLS, access is denied
      if (error.message.includes('policy')) {
        return false;
      }
      throw error;
    }
  }

  private buildTestQuery(resource: string, context: SessionContext): any {
    // Build appropriate test query based on resource type
    switch (resource.toLowerCase()) {
      case 'employees':
        return this.prisma.$queryRaw`SELECT 1 FROM employees WHERE organization_id = ${context.organizationId} LIMIT 1`;
      case 'organizations':
        return this.prisma.$queryRaw`SELECT 1 FROM organizations WHERE id = ${context.organizationId} LIMIT 1`;
      case 'departments':
        return this.prisma.$queryRaw`SELECT 1 FROM departments WHERE organization_id = ${context.organizationId} LIMIT 1`;
      case 'devices':
        return this.prisma.$queryRaw`SELECT 1 FROM devices WHERE organization_id = ${context.organizationId} LIMIT 1`;
      default:
        return this.prisma.$queryRaw`SELECT 1`;
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

  async getRLSViolations(
    organizationId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RLSAuditLog[]> {
    const where: any = {
      accessGranted: false,
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const violations = await this.prisma.rlsAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 1000, // Limit to prevent large result sets
    });

    return violations.map(v => ({
      id: v.id,
      action: v.action,
      userId: v.userId,
      organizationId: v.organizationId,
      resource: v.resource,
      policyName: v.policyName,
      accessGranted: v.accessGranted,
      reason: v.reason,
      timestamp: v.timestamp,
      requestId: v.requestId,
    }));
  }

  async getRLSMetrics(organizationId?: number): Promise<{
    totalRequests: number;
    deniedRequests: number;
    denialRate: number;
    topViolatedResources: Array<{ resource: string; count: number }>;
  }> {
    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }

    // Get total requests
    const totalRequests = await this.prisma.rlsAuditLog.count({ where });

    // Get denied requests
    const deniedRequests = await this.prisma.rlsAuditLog.count({
      where: { ...where, accessGranted: false },
    });

    // Get top violated resources
    const resourceViolations = await this.prisma.rlsAuditLog.groupBy({
      by: ['resource'],
      where: { ...where, accessGranted: false },
      _count: { resource: true },
      orderBy: { _count: { resource: 'desc' } },
      take: 10,
    });

    const topViolatedResources = resourceViolations.map(rv => ({
      resource: rv.resource,
      count: rv._count.resource,
    }));

    const denialRate = totalRequests > 0 ? (deniedRequests / totalRequests) * 100 : 0;

    return {
      totalRequests,
      deniedRequests,
      denialRate,
      topViolatedResources,
    };
  }

  async enableRLSOnTable(tableName: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY
      `;

      this.logger.log(`RLS enabled on table: ${tableName}`);
    } catch (error) {
      this.logger.error(`Failed to enable RLS on ${tableName}: ${error.message}`);
      throw error;
    }
  }

  async createRLSPolicy(
    tableName: string,
    policyName: string,
    policyDefinition: string,
  ): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        CREATE POLICY ${policyName} ON ${tableName} ${policyDefinition}
      `;

      this.logger.log(`RLS policy created: ${policyName} on ${tableName}`);
    } catch (error) {
      this.logger.error(`Failed to create RLS policy ${policyName}: ${error.message}`);
      throw error;
    }
  }

  async dropRLSPolicy(tableName: string, policyName: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        DROP POLICY IF EXISTS ${policyName} ON ${tableName}
      `;

      this.logger.log(`RLS policy dropped: ${policyName} from ${tableName}`);
    } catch (error) {
      this.logger.error(`Failed to drop RLS policy ${policyName}: ${error.message}`);
      throw error;
    }
  }
}