import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PolicyVersion, PolicyChange } from './policy-versioning.service';

export interface AuditEntry {
  id: string;
  policyId: string;
  policyVersion: string;
  action: AuditAction;
  actor: string;
  timestamp: Date;
  details: AuditDetails;
  organizationId: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata: Record<string, any>;
}

export enum AuditAction {
  POLICY_CREATED = 'policy_created',
  POLICY_UPDATED = 'policy_updated',
  POLICY_ACTIVATED = 'policy_activated',
  POLICY_DEPRECATED = 'policy_deprecated',
  POLICY_DELETED = 'policy_deleted',
  POLICY_VIEWED = 'policy_viewed',
  POLICY_COMPARED = 'policy_compared',
  POLICY_DISTRIBUTED = 'policy_distributed',
  POLICY_ROLLBACK = 'policy_rollback',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_GRANTED = 'approval_granted',
  APPROVAL_DENIED = 'approval_denied',
  DISTRIBUTION_STARTED = 'distribution_started',
  DISTRIBUTION_COMPLETED = 'distribution_completed',
  DISTRIBUTION_FAILED = 'distribution_failed',
}

export interface AuditDetails {
  description: string;
  changes?: any[];
  previousValue?: any;
  newValue?: any;
  reason?: string;
  approver?: string;
  distributionId?: string;
  affectedAgents?: number;
  errorMessage?: string;
  additionalData?: Record<string, any>;
}

export interface ApprovalWorkflow {
  id: string;
  policyId: string;
  policyVersion: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  approvers: ApprovalStep[];
  currentStep: number;
  completedAt?: Date;
  reason?: string;
  metadata: Record<string, any>;
}

export interface ApprovalStep {
  step: number;
  approver: string;
  role: string;
  status: 'pending' | 'approved' | 'denied' | 'skipped';
  approvedAt?: Date;
  comments?: string;
  required: boolean;
}

@Injectable()
export class PolicyAuditService {
  private readonly logger = new Logger(PolicyAuditService.name);
  private readonly auditEntries = new Map<string, AuditEntry>();
  private readonly approvalWorkflows = new Map<string, ApprovalWorkflow>();
  private readonly retentionDays: number;

  constructor(private readonly config: ConfigService) {
    this.retentionDays = parseInt(this.config.get('AUDIT_RETENTION_DAYS', '2555')); // 7 years default
  }

  logAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp'>): string {
    const auditId = this.generateAuditId();
    
    const auditEntry: AuditEntry = {
      id: auditId,
      timestamp: new Date(),
      ...entry,
    };

    this.auditEntries.set(auditId, auditEntry);
    
    this.logger.log(`Audit entry created: ${entry.action} for policy ${entry.policyId} by ${entry.actor}`);
    return auditId;
  }

  logPolicyCreation(policy: PolicyVersion, actor: string, sessionContext?: any): string {
    return this.logAuditEntry({
      policyId: policy.id,
      policyVersion: policy.version,
      action: AuditAction.POLICY_CREATED,
      actor,
      organizationId: policy.organizationId,
      details: {
        description: `Policy '${policy.name}' created`,
        newValue: {
          name: policy.name,
          description: policy.description,
          tags: policy.tags,
        },
      },
      sessionId: sessionContext?.sessionId,
      ipAddress: sessionContext?.ipAddress,
      userAgent: sessionContext?.userAgent,
      metadata: {
        policyName: policy.name,
        initialVersion: policy.version,
      },
    });
  }

  logPolicyUpdate(policy: PolicyVersion, changes: PolicyChange, actor: string, sessionContext?: any): string {
    return this.logAuditEntry({
      policyId: policy.id,
      policyVersion: policy.version,
      action: AuditAction.POLICY_UPDATED,
      actor,
      organizationId: policy.organizationId,
      details: {
        description: `Policy '${policy.name}' updated to version ${policy.version}`,
        changes: changes.changes,
        previousValue: changes.fromVersion,
        newValue: changes.toVersion,
        reason: changes.reason,
      },
      sessionId: sessionContext?.sessionId,
      ipAddress: sessionContext?.ipAddress,
      userAgent: sessionContext?.userAgent,
      metadata: {
        policyName: policy.name,
        changeType: changes.changeType,
        changesCount: changes.changes.length,
      },
    });
  }

  logPolicyActivation(policy: PolicyVersion, actor: string, reason?: string, sessionContext?: any): string {
    return this.logAuditEntry({
      policyId: policy.id,
      policyVersion: policy.version,
      action: AuditAction.POLICY_ACTIVATED,
      actor,
      organizationId: policy.organizationId,
      details: {
        description: `Policy '${policy.name}' v${policy.version} activated`,
        reason,
        newValue: { status: 'active' },
        previousValue: { status: policy.status },
      },
      sessionId: sessionContext?.sessionId,
      ipAddress: sessionContext?.ipAddress,
      userAgent: sessionContext?.userAgent,
      metadata: {
        policyName: policy.name,
        activatedVersion: policy.version,
      },
    });
  }

  logPolicyDistribution(policyId: string, distributionId: string, affectedAgents: number, actor: string): string {
    return this.logAuditEntry({
      policyId,
      policyVersion: '', // Will be filled by distribution service
      action: AuditAction.POLICY_DISTRIBUTED,
      actor,
      organizationId: 0, // Will be filled by distribution service
      details: {
        description: `Policy distributed to ${affectedAgents} agents`,
        distributionId,
        affectedAgents,
      },
      metadata: {
        distributionId,
        agentCount: affectedAgents,
      },
    });
  }

  logApprovalRequest(policy: PolicyVersion, requestedBy: string, approvers: string[], reason?: string): string {
    const workflowId = this.generateWorkflowId();
    
    const approvalSteps: ApprovalStep[] = approvers.map((approver, index) => ({
      step: index + 1,
      approver,
      role: 'approver', // In real implementation, get from user service
      status: 'pending',
      required: true,
    }));

    const workflow: ApprovalWorkflow = {
      id: workflowId,
      policyId: policy.id,
      policyVersion: policy.version,
      requestedBy,
      requestedAt: new Date(),
      status: 'pending',
      approvers: approvalSteps,
      currentStep: 1,
      reason,
      metadata: {
        policyName: policy.name,
        totalSteps: approvers.length,
      },
    };

    this.approvalWorkflows.set(workflowId, workflow);

    this.logAuditEntry({
      policyId: policy.id,
      policyVersion: policy.version,
      action: AuditAction.APPROVAL_REQUESTED,
      actor: requestedBy,
      organizationId: policy.organizationId,
      details: {
        description: `Approval requested for policy '${policy.name}' v${policy.version}`,
        reason,
        additionalData: {
          workflowId,
          approvers,
        },
      },
      metadata: {
        workflowId,
        approverCount: approvers.length,
      },
    });

    this.logger.log(`Approval workflow created: ${workflowId} for policy ${policy.id}`);
    return workflowId;
  }

  processApproval(workflowId: string, approver: string, approved: boolean, comments?: string): boolean {
    const workflow = this.approvalWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Approval workflow not found: ${workflowId}`);
    }

    if (workflow.status !== 'pending') {
      throw new Error(`Workflow ${workflowId} is not in pending status`);
    }

    // Find the current approval step
    const currentStep = workflow.approvers.find(step => 
      step.step === workflow.currentStep && step.approver === approver
    );

    if (!currentStep) {
      throw new Error(`Approver ${approver} not found in current step ${workflow.currentStep}`);
    }

    // Update the step
    currentStep.status = approved ? 'approved' : 'denied';
    currentStep.approvedAt = new Date();
    currentStep.comments = comments;

    // Log the approval/denial
    this.logAuditEntry({
      policyId: workflow.policyId,
      policyVersion: workflow.policyVersion,
      action: approved ? AuditAction.APPROVAL_GRANTED : AuditAction.APPROVAL_DENIED,
      actor: approver,
      organizationId: 0, // Get from policy
      details: {
        description: `Approval ${approved ? 'granted' : 'denied'} for step ${workflow.currentStep}`,
        reason: comments,
        additionalData: {
          workflowId,
          step: workflow.currentStep,
        },
      },
      metadata: {
        workflowId,
        approved,
        step: workflow.currentStep,
      },
    });

    if (!approved) {
      // Workflow denied
      workflow.status = 'denied';
      workflow.completedAt = new Date();
      return false;
    }

    // Check if all required steps are completed
    const requiredSteps = workflow.approvers.filter(step => step.required);
    const completedSteps = requiredSteps.filter(step => step.status === 'approved');

    if (completedSteps.length === requiredSteps.length) {
      // All approvals completed
      workflow.status = 'approved';
      workflow.completedAt = new Date();
      
      this.logger.log(`Approval workflow completed: ${workflowId}`);
      return true;
    } else {
      // Move to next step
      workflow.currentStep++;
      return false;
    }
  }

  getAuditTrail(policyId: string, limit?: number): AuditEntry[] {
    let entries = Array.from(this.auditEntries.values())
      .filter(entry => entry.policyId === policyId);

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      entries = entries.slice(0, limit);
    }

    return entries;
  }

  getAuditEntriesByActor(actor: string, limit?: number): AuditEntry[] {
    let entries = Array.from(this.auditEntries.values())
      .filter(entry => entry.actor === actor);

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      entries = entries.slice(0, limit);
    }

    return entries;
  }

  getAuditEntriesByAction(action: AuditAction, limit?: number): AuditEntry[] {
    let entries = Array.from(this.auditEntries.values())
      .filter(entry => entry.action === action);

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (limit) {
      entries = entries.slice(0, limit);
    }

    return entries;
  }

  getAuditEntriesByDateRange(startDate: Date, endDate: Date, organizationId?: number): AuditEntry[] {
    let entries = Array.from(this.auditEntries.values())
      .filter(entry => 
        entry.timestamp >= startDate && 
        entry.timestamp <= endDate
      );

    if (organizationId) {
      entries = entries.filter(entry => entry.organizationId === organizationId);
    }

    return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getApprovalWorkflow(workflowId: string): ApprovalWorkflow | undefined {
    return this.approvalWorkflows.get(workflowId);
  }

  getPendingApprovals(approver?: string): ApprovalWorkflow[] {
    let workflows = Array.from(this.approvalWorkflows.values())
      .filter(workflow => workflow.status === 'pending');

    if (approver) {
      workflows = workflows.filter(workflow => 
        workflow.approvers.some(step => 
          step.approver === approver && 
          step.step === workflow.currentStep &&
          step.status === 'pending'
        )
      );
    }

    return workflows.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  generateComplianceReport(organizationId: number, startDate: Date, endDate: Date): {
    summary: {
      totalPolicies: number;
      policiesCreated: number;
      policiesUpdated: number;
      policiesActivated: number;
      approvalsRequested: number;
      approvalsGranted: number;
      approvalsDenied: number;
    };
    auditEntries: AuditEntry[];
    approvalWorkflows: ApprovalWorkflow[];
  } {
    const auditEntries = this.getAuditEntriesByDateRange(startDate, endDate, organizationId);
    
    const approvalWorkflows = Array.from(this.approvalWorkflows.values())
      .filter(workflow => 
        workflow.requestedAt >= startDate && 
        workflow.requestedAt <= endDate
      );

    const summary = {
      totalPolicies: new Set(auditEntries.map(entry => entry.policyId)).size,
      policiesCreated: auditEntries.filter(entry => entry.action === AuditAction.POLICY_CREATED).length,
      policiesUpdated: auditEntries.filter(entry => entry.action === AuditAction.POLICY_UPDATED).length,
      policiesActivated: auditEntries.filter(entry => entry.action === AuditAction.POLICY_ACTIVATED).length,
      approvalsRequested: auditEntries.filter(entry => entry.action === AuditAction.APPROVAL_REQUESTED).length,
      approvalsGranted: auditEntries.filter(entry => entry.action === AuditAction.APPROVAL_GRANTED).length,
      approvalsDenied: auditEntries.filter(entry => entry.action === AuditAction.APPROVAL_DENIED).length,
    };

    return {
      summary,
      auditEntries,
      approvalWorkflows,
    };
  }

  searchAuditEntries(criteria: {
    policyId?: string;
    actor?: string;
    action?: AuditAction;
    organizationId?: number;
    startDate?: Date;
    endDate?: Date;
    sessionId?: string;
    ipAddress?: string;
    limit?: number;
  }): AuditEntry[] {
    let entries = Array.from(this.auditEntries.values());

    if (criteria.policyId) {
      entries = entries.filter(entry => entry.policyId === criteria.policyId);
    }

    if (criteria.actor) {
      entries = entries.filter(entry => entry.actor.includes(criteria.actor));
    }

    if (criteria.action) {
      entries = entries.filter(entry => entry.action === criteria.action);
    }

    if (criteria.organizationId) {
      entries = entries.filter(entry => entry.organizationId === criteria.organizationId);
    }

    if (criteria.startDate) {
      entries = entries.filter(entry => entry.timestamp >= criteria.startDate!);
    }

    if (criteria.endDate) {
      entries = entries.filter(entry => entry.timestamp <= criteria.endDate!);
    }

    if (criteria.sessionId) {
      entries = entries.filter(entry => entry.sessionId === criteria.sessionId);
    }

    if (criteria.ipAddress) {
      entries = entries.filter(entry => entry.ipAddress === criteria.ipAddress);
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (criteria.limit) {
      entries = entries.slice(0, criteria.limit);
    }

    return entries;
  }

  cleanupOldAuditEntries(): number {
    const cutoffDate = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, entry] of this.auditEntries.entries()) {
      if (entry.timestamp < cutoffDate) {
        this.auditEntries.delete(id);
        removedCount++;
      }
    }

    // Also cleanup old approval workflows
    for (const [id, workflow] of this.approvalWorkflows.entries()) {
      if (workflow.requestedAt < cutoffDate) {
        this.approvalWorkflows.delete(id);
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Cleaned up ${removedCount} old audit entries`);
    }

    return removedCount;
  }

  getAuditStatistics(): {
    totalEntries: number;
    entriesByAction: Record<string, number>;
    entriesByActor: Record<string, number>;
    entriesByOrganization: Record<number, number>;
    recentActivity: AuditEntry[];
    pendingApprovals: number;
    completedApprovals: number;
  } {
    const entries = Array.from(this.auditEntries.values());
    const workflows = Array.from(this.approvalWorkflows.values());

    const entriesByAction: Record<string, number> = {};
    const entriesByActor: Record<string, number> = {};
    const entriesByOrganization: Record<number, number> = {};

    entries.forEach(entry => {
      entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
      entriesByActor[entry.actor] = (entriesByActor[entry.actor] || 0) + 1;
      entriesByOrganization[entry.organizationId] = (entriesByOrganization[entry.organizationId] || 0) + 1;
    });

    const recentActivity = entries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalEntries: entries.length,
      entriesByAction,
      entriesByActor,
      entriesByOrganization,
      recentActivity,
      pendingApprovals: workflows.filter(w => w.status === 'pending').length,
      completedApprovals: workflows.filter(w => w.status === 'approved').length,
    };
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}