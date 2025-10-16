import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { RLSSessionService, SessionContext } from './rls-session.service';
import { Request } from 'express';
import * as crypto from 'crypto';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    organizationId: number;
    role: string;
  };
}

@Injectable()
export class RLSInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RLSInterceptor.name);

  constructor(private readonly rlsSession: RLSSessionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requestId = this.generateRequestId();

    // Extract session context from request
    const sessionContext = this.extractSessionContext(request, requestId);

    if (!sessionContext) {
      this.logger.warn('No session context found, skipping RLS setup');
      return next.handle();
    }

    this.logger.debug(`Setting up RLS for request ${requestId}`, {
      organizationId: sessionContext.organizationId,
      role: sessionContext.role,
      userId: sessionContext.userId,
    });

    // Set session context before request processing
    return new Observable(observer => {
      this.rlsSession
        .setSessionContext(sessionContext)
        .then(() => {
          // Process the request
          const subscription = next
            .handle()
            .pipe(
              tap({
                next: (data) => {
                  this.logger.debug(`Request ${requestId} completed successfully`);
                },
                error: (error) => {
                  this.logger.error(`Request ${requestId} failed: ${error.message}`);
                  
                  // Log potential RLS violations
                  if (this.isRLSError(error)) {
                    this.logRLSViolation(sessionContext, error, requestId);
                  }
                },
              }),
              finalize(() => {
                // Clear session context after request
                this.rlsSession.clearSessionContext().catch(error => {
                  this.logger.error(`Failed to clear session context: ${error.message}`);
                });
              })
            )
            .subscribe(observer);

          return () => subscription.unsubscribe();
        })
        .catch(error => {
          this.logger.error(`Failed to set session context: ${error.message}`);
          observer.error(error);
        });
    });
  }

  private extractSessionContext(request: AuthenticatedRequest, requestId: string): SessionContext | null {
    // Try to get context from authenticated user
    if (request.user) {
      return {
        organizationId: request.user.organizationId,
        role: request.user.role,
        userId: request.user.id,
        requestId,
      };
    }

    // Try to get context from headers (for service-to-service calls)
    const orgHeader = request.headers['x-organization-id'];
    const roleHeader = request.headers['x-user-role'];
    const userHeader = request.headers['x-user-id'];

    if (orgHeader && roleHeader) {
      return {
        organizationId: parseInt(orgHeader as string),
        role: roleHeader as string,
        userId: userHeader ? parseInt(userHeader as string) : undefined,
        requestId,
      };
    }

    // Try to get context from query parameters (for specific endpoints)
    if (request.query.organizationId && request.query.role) {
      return {
        organizationId: parseInt(request.query.organizationId as string),
        role: request.query.role as string,
        requestId,
      };
    }

    return null;
  }

  private generateRequestId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private isRLSError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('policy') ||
      message.includes('row level security') ||
      message.includes('permission denied') ||
      message.includes('access denied')
    );
  }

  private async logRLSViolation(
    context: SessionContext,
    error: any,
    requestId: string,
  ): Promise<void> {
    try {
      await this.rlsSession.logRLSAccess({
        action: 'DATABASE_ACCESS',
        userId: context.userId,
        organizationId: context.organizationId,
        resource: 'unknown',
        policyName: 'rls_interceptor',
        accessGranted: false,
        reason: `RLS violation: ${error.message}`,
        requestId,
      });
    } catch (logError) {
      this.logger.error(`Failed to log RLS violation: ${logError.message}`);
    }
  }
}