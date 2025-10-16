import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PolicyVersion {
  id: string;
  version: string;
  name: string;
  description?: string;
  policy: any;
  checksum: string;
  createdAt: Date;
  createdBy: string;
  organizationId: number;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  parentVersion?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface PolicyChange {
  id: string;
  policyId: string;
  fromVersion: string;
  toVersion: string;
  changeType: 'created' | 'updated' | 'deleted' | 'activated' | 'deprecated';
  changes: PolicyDiff[];
  changedBy: string;
  changedAt: Date;
  reason?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rollbackId?: string;
}

export interface PolicyDiff {
  path: string;
  operation: 'add' | 'remove' | 'replace';
  oldValue?: any;
  newValue?: any;
}

@Injectable()
export class PolicyVersioningService {
  private readonly logger = new Logger(PolicyVersioningService.name);
  private readonly policies = new Map<string, PolicyVersion>();
  private readonly changes = new Map<string, PolicyChange>();
  private readonly versionHistory = new Map<string, string[]>(); // policyId -> versions[]

  constructor(private readonly config: ConfigService) {}

  createPolicy(policyData: {
    name: string;
    description?: string;
    policy: any;
    organizationId: number;
    createdBy: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }): PolicyVersion {
    const policyId = this.generatePolicyId();
    const version = '1.0.0';
    const checksum = this.calculateChecksum(policyData.policy);

    const policyVersion: PolicyVersion = {
      id: policyId,
      version,
      name: policyData.name,
      description: policyData.description,
      policy: policyData.policy,
      checksum,
      createdAt: new Date(),
      createdBy: policyData.createdBy,
      organizationId: policyData.organizationId,
      status: 'draft',
      tags: policyData.tags || [],
      metadata: policyData.metadata || {},
    };

    this.policies.set(policyId, policyVersion);
    this.versionHistory.set(policyId, [version]);

    // Record creation change
    this.recordChange({
      policyId,
      fromVersion: '',
      toVersion: version,
      changeType: 'created',
      changes: [{
        path: '/',
        operation: 'add',
        newValue: policyData.policy,
      }],
      changedBy: policyData.createdBy,
      reason: 'Initial policy creation',
    });

    this.logger.log(`Policy created: ${policyId} v${version}`);
    return policyVersion;
  }

  updatePolicy(policyId: string, updates: {
    policy?: any;
    name?: string;
    description?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    updatedBy: string;
    reason?: string;
  }): PolicyVersion {
    const currentPolicy = this.policies.get(policyId);
    if (!currentPolicy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const newVersion = this.incrementVersion(currentPolicy.version);
    const newChecksum = updates.policy ? this.calculateChecksum(updates.policy) : currentPolicy.checksum;

    // Calculate differences
    const changes: PolicyDiff[] = [];
    if (updates.policy) {
      const diffs = this.calculateDifferences(currentPolicy.policy, updates.policy);
      changes.push(...diffs);
    }

    if (updates.name && updates.name !== currentPolicy.name) {
      changes.push({
        path: '/name',
        operation: 'replace',
        oldValue: currentPolicy.name,
        newValue: updates.name,
      });
    }

    if (updates.description && updates.description !== currentPolicy.description) {
      changes.push({
        path: '/description',
        operation: 'replace',
        oldValue: currentPolicy.description,
        newValue: updates.description,
      });
    }

    const updatedPolicy: PolicyVersion = {
      ...currentPolicy,
      version: newVersion,
      name: updates.name || currentPolicy.name,
      description: updates.description || currentPolicy.description,
      policy: updates.policy || currentPolicy.policy,
      checksum: newChecksum,
      tags: updates.tags || currentPolicy.tags,
      metadata: { ...currentPolicy.metadata, ...updates.metadata },
      parentVersion: currentPolicy.version,
      status: 'draft', // New version starts as draft
    };

    this.policies.set(policyId, updatedPolicy);
    
    // Update version history
    const versions = this.versionHistory.get(policyId) || [];
    versions.push(newVersion);
    this.versionHistory.set(policyId, versions);

    // Record change
    this.recordChange({
      policyId,
      fromVersion: currentPolicy.version,
      toVersion: newVersion,
      changeType: 'updated',
      changes,
      changedBy: updates.updatedBy,
      reason: updates.reason,
    });

    this.logger.log(`Policy updated: ${policyId} v${currentPolicy.version} -> v${newVersion}`);
    return updatedPolicy;
  }

  activatePolicy(policyId: string, activatedBy: string, reason?: string): PolicyVersion {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    if (policy.status === 'active') {
      throw new Error(`Policy ${policyId} is already active`);
    }

    // Deactivate other active versions of the same policy
    const versions = this.versionHistory.get(policyId) || [];
    for (const version of versions) {
      const versionPolicy = this.getPolicyVersion(policyId, version);
      if (versionPolicy && versionPolicy.status === 'active') {
        versionPolicy.status = 'deprecated';
        this.recordChange({
          policyId,
          fromVersion: version,
          toVersion: version,
          changeType: 'deprecated',
          changes: [],
          changedBy: activatedBy,
          reason: `Deprecated due to activation of v${policy.version}`,
        });
      }
    }

    policy.status = 'active';

    this.recordChange({
      policyId,
      fromVersion: policy.version,
      toVersion: policy.version,
      changeType: 'activated',
      changes: [],
      changedBy: activatedBy,
      reason,
    });

    this.logger.log(`Policy activated: ${policyId} v${policy.version}`);
    return policy;
  }

  deprecatePolicy(policyId: string, deprecatedBy: string, reason?: string): PolicyVersion {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    policy.status = 'deprecated';

    this.recordChange({
      policyId,
      fromVersion: policy.version,
      toVersion: policy.version,
      changeType: 'deprecated',
      changes: [],
      changedBy: deprecatedBy,
      reason,
    });

    this.logger.log(`Policy deprecated: ${policyId} v${policy.version}`);
    return policy;
  }

  getPolicy(policyId: string): PolicyVersion | undefined {
    return this.policies.get(policyId);
  }

  getPolicyVersion(policyId: string, version: string): PolicyVersion | undefined {
    const versions = this.versionHistory.get(policyId) || [];
    if (!versions.includes(version)) {
      return undefined;
    }

    // For simplicity, we're storing only the latest version
    // In a real implementation, you'd store all versions
    const currentPolicy = this.policies.get(policyId);
    if (currentPolicy && currentPolicy.version === version) {
      return currentPolicy;
    }

    return undefined;
  }

  getActivePolicies(organizationId?: number): PolicyVersion[] {
    const policies = Array.from(this.policies.values())
      .filter(policy => policy.status === 'active');

    if (organizationId) {
      return policies.filter(policy => policy.organizationId === organizationId);
    }

    return policies;
  }

  getPolicyVersions(policyId: string): string[] {
    return this.versionHistory.get(policyId) || [];
  }

  getPolicyChanges(policyId: string): PolicyChange[] {
    return Array.from(this.changes.values())
      .filter(change => change.policyId === policyId)
      .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
  }

  getAllPolicies(organizationId?: number): PolicyVersion[] {
    const policies = Array.from(this.policies.values());

    if (organizationId) {
      return policies.filter(policy => policy.organizationId === organizationId);
    }

    return policies;
  }

  searchPolicies(criteria: {
    organizationId?: number;
    name?: string;
    tags?: string[];
    status?: PolicyVersion['status'];
    createdBy?: string;
    createdAfter?: Date;
    createdBefore?: Date;
  }): PolicyVersion[] {
    let policies = Array.from(this.policies.values());

    if (criteria.organizationId) {
      policies = policies.filter(p => p.organizationId === criteria.organizationId);
    }

    if (criteria.name) {
      const nameRegex = new RegExp(criteria.name, 'i');
      policies = policies.filter(p => nameRegex.test(p.name));
    }

    if (criteria.tags && criteria.tags.length > 0) {
      policies = policies.filter(p => 
        criteria.tags!.some(tag => p.tags.includes(tag))
      );
    }

    if (criteria.status) {
      policies = policies.filter(p => p.status === criteria.status);
    }

    if (criteria.createdBy) {
      policies = policies.filter(p => p.createdBy === criteria.createdBy);
    }

    if (criteria.createdAfter) {
      policies = policies.filter(p => p.createdAt >= criteria.createdAfter!);
    }

    if (criteria.createdBefore) {
      policies = policies.filter(p => p.createdAt <= criteria.createdBefore!);
    }

    return policies.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  rollbackPolicy(policyId: string, targetVersion: string, rolledBackBy: string, reason?: string): PolicyVersion {
    const targetPolicy = this.getPolicyVersion(policyId, targetVersion);
    if (!targetPolicy) {
      throw new Error(`Policy version not found: ${policyId} v${targetVersion}`);
    }

    const currentPolicy = this.policies.get(policyId);
    if (!currentPolicy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // Create new version based on target version
    const rollbackVersion = this.incrementVersion(currentPolicy.version);
    const rollbackPolicy: PolicyVersion = {
      ...targetPolicy,
      version: rollbackVersion,
      createdAt: new Date(),
      createdBy: rolledBackBy,
      parentVersion: currentPolicy.version,
      status: 'draft',
      metadata: {
        ...targetPolicy.metadata,
        rollbackFrom: currentPolicy.version,
        rollbackTo: targetVersion,
      },
    };

    this.policies.set(policyId, rollbackPolicy);

    // Update version history
    const versions = this.versionHistory.get(policyId) || [];
    versions.push(rollbackVersion);
    this.versionHistory.set(policyId, versions);

    // Record rollback change
    const rollbackChangeId = this.recordChange({
      policyId,
      fromVersion: currentPolicy.version,
      toVersion: rollbackVersion,
      changeType: 'updated',
      changes: this.calculateDifferences(currentPolicy.policy, targetPolicy.policy),
      changedBy: rolledBackBy,
      reason: reason || `Rollback to version ${targetVersion}`,
    });

    // Update the rollback reference
    const rollbackChange = this.changes.get(rollbackChangeId);
    if (rollbackChange) {
      rollbackChange.rollbackId = targetVersion;
    }

    this.logger.log(`Policy rolled back: ${policyId} v${currentPolicy.version} -> v${rollbackVersion} (rollback to v${targetVersion})`);
    return rollbackPolicy;
  }

  validatePolicy(policy: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!policy || typeof policy !== 'object') {
      errors.push('Policy must be a valid object');
      return { valid: false, errors };
    }

    // Basic validation rules
    if (!policy.name || typeof policy.name !== 'string') {
      errors.push('Policy must have a valid name');
    }

    if (policy.rules && !Array.isArray(policy.rules)) {
      errors.push('Policy rules must be an array');
    }

    if (policy.settings && typeof policy.settings !== 'object') {
      errors.push('Policy settings must be an object');
    }

    // Validate rule structure
    if (policy.rules) {
      policy.rules.forEach((rule: any, index: number) => {
        if (!rule.id || typeof rule.id !== 'string') {
          errors.push(`Rule ${index} must have a valid id`);
        }

        if (!rule.type || typeof rule.type !== 'string') {
          errors.push(`Rule ${index} must have a valid type`);
        }

        if (rule.enabled !== undefined && typeof rule.enabled !== 'boolean') {
          errors.push(`Rule ${index} enabled flag must be boolean`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private generatePolicyId(): string {
    return `policy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(policy: any): string {
    const policyString = JSON.stringify(policy, Object.keys(policy).sort());
    return crypto.createHash('sha256').update(policyString).digest('hex');
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }

  private calculateDifferences(oldPolicy: any, newPolicy: any): PolicyDiff[] {
    const diffs: PolicyDiff[] = [];
    
    // Simple diff calculation (in production, use a proper diff library)
    const oldKeys = new Set(Object.keys(oldPolicy || {}));
    const newKeys = new Set(Object.keys(newPolicy || {}));
    
    // Added keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        diffs.push({
          path: `/${key}`,
          operation: 'add',
          newValue: newPolicy[key],
        });
      }
    }
    
    // Removed keys
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        diffs.push({
          path: `/${key}`,
          operation: 'remove',
          oldValue: oldPolicy[key],
        });
      }
    }
    
    // Modified keys
    for (const key of newKeys) {
      if (oldKeys.has(key) && JSON.stringify(oldPolicy[key]) !== JSON.stringify(newPolicy[key])) {
        diffs.push({
          path: `/${key}`,
          operation: 'replace',
          oldValue: oldPolicy[key],
          newValue: newPolicy[key],
        });
      }
    }
    
    return diffs;
  }

  private recordChange(changeData: {
    policyId: string;
    fromVersion: string;
    toVersion: string;
    changeType: PolicyChange['changeType'];
    changes: PolicyDiff[];
    changedBy: string;
    reason?: string;
  }): string {
    const changeId = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const change: PolicyChange = {
      id: changeId,
      policyId: changeData.policyId,
      fromVersion: changeData.fromVersion,
      toVersion: changeData.toVersion,
      changeType: changeData.changeType,
      changes: changeData.changes,
      changedBy: changeData.changedBy,
      changedAt: new Date(),
      reason: changeData.reason,
    };

    this.changes.set(changeId, change);
    return changeId;
  }

  getChangeHistory(policyId?: string, limit?: number): PolicyChange[] {
    let changes = Array.from(this.changes.values());

    if (policyId) {
      changes = changes.filter(change => change.policyId === policyId);
    }

    changes.sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());

    if (limit) {
      changes = changes.slice(0, limit);
    }

    return changes;
  }

  getVersioningStats(): {
    totalPolicies: number;
    activePolicies: number;
    draftPolicies: number;
    deprecatedPolicies: number;
    totalVersions: number;
    totalChanges: number;
    organizationStats: Record<number, {
      policies: number;
      active: number;
      versions: number;
    }>;
  } {
    const policies = Array.from(this.policies.values());
    const totalVersions = Array.from(this.versionHistory.values())
      .reduce((sum, versions) => sum + versions.length, 0);

    const organizationStats: Record<number, any> = {};
    
    policies.forEach(policy => {
      if (!organizationStats[policy.organizationId]) {
        organizationStats[policy.organizationId] = {
          policies: 0,
          active: 0,
          versions: 0,
        };
      }
      
      organizationStats[policy.organizationId].policies++;
      if (policy.status === 'active') {
        organizationStats[policy.organizationId].active++;
      }
      
      const versions = this.versionHistory.get(policy.id) || [];
      organizationStats[policy.organizationId].versions += versions.length;
    });

    return {
      totalPolicies: policies.length,
      activePolicies: policies.filter(p => p.status === 'active').length,
      draftPolicies: policies.filter(p => p.status === 'draft').length,
      deprecatedPolicies: policies.filter(p => p.status === 'deprecated').length,
      totalVersions,
      totalChanges: this.changes.size,
      organizationStats,
    };
  }
}