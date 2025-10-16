import { Injectable, Logger } from '@nestjs/common';
import { PolicyVersion, PolicyDiff } from './policy-versioning.service';

export interface ComparisonResult {
  id: string;
  fromPolicy: PolicyVersion;
  toPolicy: PolicyVersion;
  differences: PolicyDiff[];
  impactAnalysis: ImpactAnalysis;
  rollbackPlan: RollbackPlan;
  createdAt: Date;
}

export interface ImpactAnalysis {
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedAgents: number;
  affectedRules: string[];
  breakingChanges: string[];
  newFeatures: string[];
  deprecatedFeatures: string[];
  securityImpact: SecurityImpact;
  performanceImpact: PerformanceImpact;
  compatibilityIssues: string[];
}

export interface SecurityImpact {
  level: 'none' | 'low' | 'medium' | 'high';
  changes: string[];
  recommendations: string[];
}

export interface PerformanceImpact {
  level: 'none' | 'low' | 'medium' | 'high';
  estimatedChange: string;
  affectedOperations: string[];
  recommendations: string[];
}

export interface RollbackPlan {
  canRollback: boolean;
  rollbackSteps: RollbackStep[];
  estimatedTime: number; // minutes
  risks: string[];
  prerequisites: string[];
}

export interface RollbackStep {
  step: number;
  action: string;
  description: string;
  estimatedTime: number; // minutes
  critical: boolean;
}

@Injectable()
export class PolicyComparisonService {
  private readonly logger = new Logger(PolicyComparisonService.name);
  private readonly comparisons = new Map<string, ComparisonResult>();

  compareVersions(fromPolicy: PolicyVersion, toPolicy: PolicyVersion): ComparisonResult {
    const comparisonId = this.generateComparisonId(fromPolicy.id, fromPolicy.version, toPolicy.version);
    
    const differences = this.calculateDetailedDifferences(fromPolicy.policy, toPolicy.policy);
    const impactAnalysis = this.analyzeImpact(fromPolicy, toPolicy, differences);
    const rollbackPlan = this.generateRollbackPlan(fromPolicy, toPolicy, differences);

    const comparison: ComparisonResult = {
      id: comparisonId,
      fromPolicy,
      toPolicy,
      differences,
      impactAnalysis,
      rollbackPlan,
      createdAt: new Date(),
    };

    this.comparisons.set(comparisonId, comparison);
    
    this.logger.log(`Policy comparison created: ${fromPolicy.id} v${fromPolicy.version} -> v${toPolicy.version}`);
    return comparison;
  }

  getComparison(comparisonId: string): ComparisonResult | undefined {
    return this.comparisons.get(comparisonId);
  }

  generateDiffReport(comparison: ComparisonResult): string {
    const { fromPolicy, toPolicy, differences, impactAnalysis } = comparison;
    
    let report = `# Policy Comparison Report\n\n`;
    report += `**From:** ${fromPolicy.name} v${fromPolicy.version}\n`;
    report += `**To:** ${toPolicy.name} v${toPolicy.version}\n`;
    report += `**Generated:** ${comparison.createdAt.toISOString()}\n\n`;

    // Summary
    report += `## Summary\n\n`;
    report += `- **Total Changes:** ${differences.length}\n`;
    report += `- **Impact Severity:** ${impactAnalysis.severity}\n`;
    report += `- **Affected Agents:** ${impactAnalysis.affectedAgents}\n`;
    report += `- **Breaking Changes:** ${impactAnalysis.breakingChanges.length}\n\n`;

    // Detailed Changes
    report += `## Detailed Changes\n\n`;
    
    const addedChanges = differences.filter(d => d.operation === 'add');
    const removedChanges = differences.filter(d => d.operation === 'remove');
    const modifiedChanges = differences.filter(d => d.operation === 'replace');

    if (addedChanges.length > 0) {
      report += `### Added (${addedChanges.length})\n\n`;
      addedChanges.forEach(change => {
        report += `- **${change.path}**: ${JSON.stringify(change.newValue)}\n`;
      });
      report += `\n`;
    }

    if (removedChanges.length > 0) {
      report += `### Removed (${removedChanges.length})\n\n`;
      removedChanges.forEach(change => {
        report += `- **${change.path}**: ${JSON.stringify(change.oldValue)}\n`;
      });
      report += `\n`;
    }

    if (modifiedChanges.length > 0) {
      report += `### Modified (${modifiedChanges.length})\n\n`;
      modifiedChanges.forEach(change => {
        report += `- **${change.path}**:\n`;
        report += `  - From: ${JSON.stringify(change.oldValue)}\n`;
        report += `  - To: ${JSON.stringify(change.newValue)}\n`;
      });
      report += `\n`;
    }

    // Impact Analysis
    report += `## Impact Analysis\n\n`;
    report += `### Security Impact: ${impactAnalysis.securityImpact.level}\n\n`;
    if (impactAnalysis.securityImpact.changes.length > 0) {
      impactAnalysis.securityImpact.changes.forEach(change => {
        report += `- ${change}\n`;
      });
      report += `\n`;
    }

    report += `### Performance Impact: ${impactAnalysis.performanceImpact.level}\n\n`;
    if (impactAnalysis.performanceImpact.estimatedChange) {
      report += `**Estimated Change:** ${impactAnalysis.performanceImpact.estimatedChange}\n\n`;
    }

    if (impactAnalysis.breakingChanges.length > 0) {
      report += `### Breaking Changes\n\n`;
      impactAnalysis.breakingChanges.forEach(change => {
        report += `- ${change}\n`;
      });
      report += `\n`;
    }

    if (impactAnalysis.compatibilityIssues.length > 0) {
      report += `### Compatibility Issues\n\n`;
      impactAnalysis.compatibilityIssues.forEach(issue => {
        report += `- ${issue}\n`;
      });
      report += `\n`;
    }

    // Rollback Plan
    report += `## Rollback Plan\n\n`;
    report += `**Can Rollback:** ${comparison.rollbackPlan.canRollback ? 'Yes' : 'No'}\n`;
    report += `**Estimated Time:** ${comparison.rollbackPlan.estimatedTime} minutes\n\n`;

    if (comparison.rollbackPlan.rollbackSteps.length > 0) {
      report += `### Steps\n\n`;
      comparison.rollbackPlan.rollbackSteps.forEach(step => {
        const criticalFlag = step.critical ? ' ⚠️' : '';
        report += `${step.step}. **${step.action}**${criticalFlag} (${step.estimatedTime}min)\n`;
        report += `   ${step.description}\n\n`;
      });
    }

    if (comparison.rollbackPlan.risks.length > 0) {
      report += `### Risks\n\n`;
      comparison.rollbackPlan.risks.forEach(risk => {
        report += `- ${risk}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  private calculateDetailedDifferences(oldPolicy: any, newPolicy: any, basePath = ''): PolicyDiff[] {
    const diffs: PolicyDiff[] = [];
    
    if (oldPolicy === null || oldPolicy === undefined) {
      if (newPolicy !== null && newPolicy !== undefined) {
        diffs.push({
          path: basePath || '/',
          operation: 'add',
          newValue: newPolicy,
        });
      }
      return diffs;
    }

    if (newPolicy === null || newPolicy === undefined) {
      diffs.push({
        path: basePath || '/',
        operation: 'remove',
        oldValue: oldPolicy,
      });
      return diffs;
    }

    if (typeof oldPolicy !== typeof newPolicy) {
      diffs.push({
        path: basePath || '/',
        operation: 'replace',
        oldValue: oldPolicy,
        newValue: newPolicy,
      });
      return diffs;
    }

    if (typeof oldPolicy === 'object' && !Array.isArray(oldPolicy)) {
      const oldKeys = new Set(Object.keys(oldPolicy));
      const newKeys = new Set(Object.keys(newPolicy));
      
      // Added keys
      for (const key of newKeys) {
        if (!oldKeys.has(key)) {
          diffs.push({
            path: `${basePath}/${key}`,
            operation: 'add',
            newValue: newPolicy[key],
          });
        }
      }
      
      // Removed keys
      for (const key of oldKeys) {
        if (!newKeys.has(key)) {
          diffs.push({
            path: `${basePath}/${key}`,
            operation: 'remove',
            oldValue: oldPolicy[key],
          });
        }
      }
      
      // Modified keys
      for (const key of newKeys) {
        if (oldKeys.has(key)) {
          const nestedDiffs = this.calculateDetailedDifferences(
            oldPolicy[key],
            newPolicy[key],
            `${basePath}/${key}`
          );
          diffs.push(...nestedDiffs);
        }
      }
    } else if (Array.isArray(oldPolicy) && Array.isArray(newPolicy)) {
      // Array comparison
      const maxLength = Math.max(oldPolicy.length, newPolicy.length);
      
      for (let i = 0; i < maxLength; i++) {
        if (i >= oldPolicy.length) {
          diffs.push({
            path: `${basePath}[${i}]`,
            operation: 'add',
            newValue: newPolicy[i],
          });
        } else if (i >= newPolicy.length) {
          diffs.push({
            path: `${basePath}[${i}]`,
            operation: 'remove',
            oldValue: oldPolicy[i],
          });
        } else {
          const nestedDiffs = this.calculateDetailedDifferences(
            oldPolicy[i],
            newPolicy[i],
            `${basePath}[${i}]`
          );
          diffs.push(...nestedDiffs);
        }
      }
    } else if (oldPolicy !== newPolicy) {
      diffs.push({
        path: basePath || '/',
        operation: 'replace',
        oldValue: oldPolicy,
        newValue: newPolicy,
      });
    }
    
    return diffs;
  }

  private analyzeImpact(fromPolicy: PolicyVersion, toPolicy: PolicyVersion, differences: PolicyDiff[]): ImpactAnalysis {
    const breakingChanges: string[] = [];
    const newFeatures: string[] = [];
    const deprecatedFeatures: string[] = [];
    const affectedRules: string[] = [];
    const compatibilityIssues: string[] = [];

    // Analyze each difference for impact
    differences.forEach(diff => {
      if (diff.path.includes('/rules/')) {
        affectedRules.push(diff.path);
        
        if (diff.operation === 'remove') {
          breakingChanges.push(`Rule removed: ${diff.path}`);
          deprecatedFeatures.push(diff.path);
        } else if (diff.operation === 'add') {
          newFeatures.push(`New rule added: ${diff.path}`);
        } else if (diff.operation === 'replace') {
          // Check if it's a breaking change
          if (this.isBreakingRuleChange(diff)) {
            breakingChanges.push(`Rule modified with breaking changes: ${diff.path}`);
          }
        }
      }

      if (diff.path.includes('/settings/')) {
        if (diff.operation === 'remove') {
          breakingChanges.push(`Setting removed: ${diff.path}`);
        } else if (diff.operation === 'replace') {
          if (this.isBreakingSettingChange(diff)) {
            breakingChanges.push(`Setting modified with breaking changes: ${diff.path}`);
          }
        }
      }

      // Check for compatibility issues
      if (this.hasCompatibilityIssue(diff)) {
        compatibilityIssues.push(`Compatibility issue at ${diff.path}`);
      }
    });

    // Determine severity
    let severity: ImpactAnalysis['severity'] = 'low';
    if (breakingChanges.length > 5 || this.hasCriticalChanges(differences)) {
      severity = 'critical';
    } else if (breakingChanges.length > 2 || affectedRules.length > 10) {
      severity = 'high';
    } else if (breakingChanges.length > 0 || affectedRules.length > 5) {
      severity = 'medium';
    }

    // Estimate affected agents (mock calculation)
    const affectedAgents = Math.min(1000, Math.max(1, affectedRules.length * 10));

    const securityImpact = this.analyzeSecurityImpact(differences);
    const performanceImpact = this.analyzePerformanceImpact(differences);

    return {
      severity,
      affectedAgents,
      affectedRules,
      breakingChanges,
      newFeatures,
      deprecatedFeatures,
      securityImpact,
      performanceImpact,
      compatibilityIssues,
    };
  }

  private analyzeSecurityImpact(differences: PolicyDiff[]): SecurityImpact {
    const securityChanges: string[] = [];
    const recommendations: string[] = [];
    let level: SecurityImpact['level'] = 'none';

    differences.forEach(diff => {
      if (diff.path.includes('security') || diff.path.includes('auth') || diff.path.includes('permission')) {
        level = 'high';
        securityChanges.push(`Security-related change at ${diff.path}`);
        
        if (diff.operation === 'remove') {
          recommendations.push(`Review removal of security setting: ${diff.path}`);
        } else if (diff.operation === 'replace') {
          recommendations.push(`Validate security change: ${diff.path}`);
        }
      }

      if (diff.path.includes('encryption') || diff.path.includes('certificate')) {
        level = 'high';
        securityChanges.push(`Encryption/certificate change at ${diff.path}`);
        recommendations.push(`Test encryption functionality after deployment`);
      }
    });

    if (securityChanges.length === 0) {
      level = 'none';
    } else if (securityChanges.length <= 2) {
      level = level === 'high' ? 'high' : 'low';
    } else {
      level = 'high';
    }

    return {
      level,
      changes: securityChanges,
      recommendations,
    };
  }

  private analyzePerformanceImpact(differences: PolicyDiff[]): PerformanceImpact {
    const affectedOperations: string[] = [];
    const recommendations: string[] = [];
    let level: PerformanceImpact['level'] = 'none';
    let estimatedChange = 'No significant impact expected';

    differences.forEach(diff => {
      if (diff.path.includes('interval') || diff.path.includes('timeout') || diff.path.includes('frequency')) {
        level = 'medium';
        affectedOperations.push(`Timing change: ${diff.path}`);
        
        if (diff.operation === 'replace' && typeof diff.oldValue === 'number' && typeof diff.newValue === 'number') {
          const change = ((diff.newValue - diff.oldValue) / diff.oldValue) * 100;
          if (Math.abs(change) > 50) {
            level = 'high';
            estimatedChange = `${change > 0 ? 'Increase' : 'Decrease'} of ${Math.abs(change).toFixed(1)}%`;
          }
        }
      }

      if (diff.path.includes('cache') || diff.path.includes('buffer')) {
        level = 'medium';
        affectedOperations.push(`Caching/buffering change: ${diff.path}`);
        recommendations.push(`Monitor performance metrics after deployment`);
      }

      if (diff.path.includes('batch') || diff.path.includes('concurrent')) {
        level = 'medium';
        affectedOperations.push(`Concurrency change: ${diff.path}`);
        recommendations.push(`Load test the new configuration`);
      }
    });

    return {
      level,
      estimatedChange,
      affectedOperations,
      recommendations,
    };
  }

  private generateRollbackPlan(fromPolicy: PolicyVersion, toPolicy: PolicyVersion, differences: PolicyDiff[]): RollbackPlan {
    const rollbackSteps: RollbackStep[] = [];
    const risks: string[] = [];
    const prerequisites: string[] = [];
    let estimatedTime = 5; // Base time in minutes
    let canRollback = true;

    // Check if rollback is possible
    if (differences.some(diff => this.isIrreversibleChange(diff))) {
      canRollback = false;
      risks.push('Some changes are irreversible');
    }

    if (canRollback) {
      // Step 1: Prepare rollback
      rollbackSteps.push({
        step: 1,
        action: 'Prepare Rollback',
        description: 'Backup current policy state and prepare rollback environment',
        estimatedTime: 2,
        critical: true,
      });

      // Step 2: Stop policy distribution
      rollbackSteps.push({
        step: 2,
        action: 'Stop Distribution',
        description: 'Halt policy distribution to prevent further propagation',
        estimatedTime: 1,
        critical: true,
      });

      // Step 3: Rollback policy version
      rollbackSteps.push({
        step: 3,
        action: 'Rollback Policy',
        description: `Revert to policy version ${fromPolicy.version}`,
        estimatedTime: 2,
        critical: true,
      });

      // Step 4: Redistribute old policy
      rollbackSteps.push({
        step: 4,
        action: 'Redistribute Policy',
        description: 'Distribute the rolled-back policy to all agents',
        estimatedTime: 5,
        critical: false,
      });

      // Step 5: Verify rollback
      rollbackSteps.push({
        step: 5,
        action: 'Verify Rollback',
        description: 'Confirm all agents have received and applied the rolled-back policy',
        estimatedTime: 3,
        critical: false,
      });

      estimatedTime = rollbackSteps.reduce((sum, step) => sum + step.estimatedTime, 0);

      // Add risks based on changes
      if (differences.length > 10) {
        risks.push('Large number of changes may complicate rollback');
        estimatedTime += 5;
      }

      if (differences.some(diff => diff.path.includes('security'))) {
        risks.push('Security-related changes may require additional validation');
        prerequisites.push('Security team approval for rollback');
      }

      if (differences.some(diff => diff.path.includes('database') || diff.path.includes('migration'))) {
        risks.push('Database changes may require data migration rollback');
        prerequisites.push('Database backup verification');
      }
    }

    return {
      canRollback,
      rollbackSteps,
      estimatedTime,
      risks,
      prerequisites,
    };
  }

  private isBreakingRuleChange(diff: PolicyDiff): boolean {
    // Check if the rule change is breaking
    if (diff.operation === 'replace' && diff.oldValue && diff.newValue) {
      // Check for type changes
      if (diff.oldValue.type !== diff.newValue.type) {
        return true;
      }
      
      // Check for required field removal
      if (diff.oldValue.required && !diff.newValue.required) {
        return true;
      }
      
      // Check for validation rule changes
      if (diff.oldValue.validation && !diff.newValue.validation) {
        return true;
      }
    }
    
    return false;
  }

  private isBreakingSettingChange(diff: PolicyDiff): boolean {
    // Check if the setting change is breaking
    if (diff.operation === 'replace' && diff.oldValue && diff.newValue) {
      // Type changes are usually breaking
      if (typeof diff.oldValue !== typeof diff.newValue) {
        return true;
      }
      
      // Significant value changes for critical settings
      if (typeof diff.oldValue === 'number' && typeof diff.newValue === 'number') {
        const change = Math.abs((diff.newValue - diff.oldValue) / diff.oldValue);
        if (change > 0.5) { // 50% change threshold
          return true;
        }
      }
    }
    
    return false;
  }

  private hasCompatibilityIssue(diff: PolicyDiff): boolean {
    // Check for known compatibility issues
    const incompatiblePaths = [
      '/version',
      '/apiVersion',
      '/schema',
      '/format',
    ];
    
    return incompatiblePaths.some(path => diff.path.includes(path));
  }

  private hasCriticalChanges(differences: PolicyDiff[]): boolean {
    const criticalPaths = [
      '/security',
      '/authentication',
      '/authorization',
      '/encryption',
      '/database',
    ];
    
    return differences.some(diff => 
      criticalPaths.some(path => diff.path.includes(path)) &&
      (diff.operation === 'remove' || diff.operation === 'replace')
    );
  }

  private isIrreversibleChange(diff: PolicyDiff): boolean {
    // Check for changes that cannot be rolled back
    const irreversiblePaths = [
      '/migration',
      '/dataDestruction',
      '/permanentDelete',
    ];
    
    return irreversiblePaths.some(path => diff.path.includes(path)) &&
           diff.operation === 'add';
  }

  private generateComparisonId(policyId: string, fromVersion: string, toVersion: string): string {
    return `comparison_${policyId}_${fromVersion}_${toVersion}_${Date.now()}`;
  }

  getComparisonHistory(policyId?: string, limit?: number): ComparisonResult[] {
    let comparisons = Array.from(this.comparisons.values());

    if (policyId) {
      comparisons = comparisons.filter(comp => 
        comp.fromPolicy.id === policyId || comp.toPolicy.id === policyId
      );
    }

    comparisons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (limit) {
      comparisons = comparisons.slice(0, limit);
    }

    return comparisons;
  }

  clearComparisonHistory(olderThanDays: number = 30): number {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    for (const [id, comparison] of this.comparisons.entries()) {
      if (comparison.createdAt < cutoff) {
        this.comparisons.delete(id);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.log(`Cleared ${removedCount} old policy comparisons`);
    }

    return removedCount;
  }
}