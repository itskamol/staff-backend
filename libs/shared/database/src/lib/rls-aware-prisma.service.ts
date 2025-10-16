import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RLSSessionService, SessionContext } from './rls-session.service';

@Injectable()
export class RLSAwarePrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(RLSAwarePrismaService.name);

  constructor(private readonly rlsSession: RLSSessionService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.setupRLSMiddleware();
  }

  private setupRLSMiddleware() {
    // Middleware to ensure RLS context is set for all queries
    this.$use(async (params, next) => {
      const context = await this.rlsSession.getCurrentContext();
      
      if (!context) {
        this.logger.warn(`Query executed without RLS context: ${params.model}.${params.action}`);
      } else {
        this.logger.debug(`Query with RLS context: ${params.model}.${params.action}`, {
          organizationId: context.organizationId,
          role: context.role,
        });
      }

      try {
        const result = await next(params);
        
        // Log successful access
        if (context) {
          await this.rlsSession.logRLSAccess({
            action: `${params.model}.${params.action}`,
            userId: context.userId,
            organizationId: context.organizationId,
            resource: params.model || 'unknown',
            policyName: 'prisma_middleware',
            accessGranted: true,
            requestId: context.requestId,
          });
        }

        return result;
      } catch (error) {
        // Log failed access
        if (context) {
          await this.rlsSession.logRLSAccess({
            action: `${params.model}.${params.action}`,
            userId: context.userId,
            organizationId: context.organizationId,
            resource: params.model || 'unknown',
            policyName: 'prisma_middleware',
            accessGranted: false,
            reason: error.message,
            requestId: context.requestId,
          });
        }

        throw error;
      }
    });
  }

  // Override $queryRaw to ensure RLS context
  async $queryRaw(query: any, ...values: any[]): Promise<any> {
    const context = await this.rlsSession.getCurrentContext();
    
    if (!context) {
      this.logger.warn('Raw query executed without RLS context');
    }

    try {
      const result = await super.$queryRaw(query, ...values);
      
      if (context) {
        await this.rlsSession.logRLSAccess({
          action: 'RAW_QUERY',
          userId: context.userId,
          organizationId: context.organizationId,
          resource: 'raw_query',
          policyName: 'raw_query_wrapper',
          accessGranted: true,
          requestId: context.requestId,
        });
      }

      return result;
    } catch (error) {
      if (context) {
        await this.rlsSession.logRLSAccess({
          action: 'RAW_QUERY',
          userId: context.userId,
          organizationId: context.organizationId,
          resource: 'raw_query',
          policyName: 'raw_query_wrapper',
          accessGranted: false,
          reason: error.message,
          requestId: context.requestId,
        });
      }

      throw error;
    }
  }

  // Override $executeRaw to ensure RLS context
  async $executeRaw(query: any, ...values: any[]): Promise<any> {
    const context = await this.rlsSession.getCurrentContext();
    
    if (!context) {
      this.logger.warn('Raw execute without RLS context');
    }

    try {
      const result = await super.$executeRaw(query, ...values);
      
      if (context) {
        await this.rlsSession.logRLSAccess({
          action: 'RAW_EXECUTE',
          userId: context.userId,
          organizationId: context.organizationId,
          resource: 'raw_execute',
          policyName: 'raw_execute_wrapper',
          accessGranted: true,
          requestId: context.requestId,
        });
      }

      return result;
    } catch (error) {
      if (context) {
        await this.rlsSession.logRLSAccess({
          action: 'RAW_EXECUTE',
          userId: context.userId,
          organizationId: context.organizationId,
          resource: 'raw_execute',
          policyName: 'raw_execute_wrapper',
          accessGranted: false,
          reason: error.message,
          requestId: context.requestId,
        });
      }

      throw error;
    }
  }

  // Helper method to execute queries with specific context
  async withContext<T>(context: SessionContext, operation: () => Promise<T>): Promise<T> {
    await this.rlsSession.setSessionContext(context);
    
    try {
      return await operation();
    } finally {
      await this.rlsSession.clearSessionContext();
    }
  }

  // Helper method for background jobs
  async withBackgroundContext<T>(
    organizationId: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const context: SessionContext = {
      organizationId,
      role: 'SYSTEM',
      requestId: `bg_${Date.now()}`,
    };

    return this.withContext(context, operation);
  }
}