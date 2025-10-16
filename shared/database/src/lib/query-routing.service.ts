import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DualPrismaService } from './dual-prisma.service';

export interface QueryRoute {
  datasource: 'postgresql' | 'timescale' | 'fallback';
  reason: string;
  fallbackAvailable: boolean;
}

export interface QueryMetrics {
  totalQueries: number;
  timescaleQueries: number;
  postgresQueries: number;
  fallbackQueries: number;
  averageLatency: number;
  errorRate: number;
}

export interface RoutingRule {
  pattern: string | RegExp;
  datasource: 'postgresql' | 'timescale';
  priority: number;
  conditions?: {
    tableNames?: string[];
    operations?: string[];
    timeRange?: boolean;
  };
}

@Injectable()
export class QueryRoutingService {
  private readonly logger = new Logger(QueryRoutingService.name);
  
  private queryMetrics: QueryMetrics = {
    totalQueries: 0,
    timescaleQueries: 0,
    postgresQueries: 0,
    fallbackQueries: 0,
    averageLatency: 0,
    errorRate: 0,
  };

  private routingRules: RoutingRule[] = [
    // Time-series data rules (highest priority)
    {
      pattern: /active_?windows?/i,
      datasource: 'timescale',
      priority: 100,
      conditions: {
        tableNames: ['active_windows', 'monitoring.active_windows'],
        operations: ['INSERT', 'SELECT', 'CREATE'],
        timeRange: true,
      },
    },
    {
      pattern: /visited_?sites?/i,
      datasource: 'timescale',
      priority: 100,
      conditions: {
        tableNames: ['visited_sites', 'monitoring.visited_sites'],
        operations: ['INSERT', 'SELECT', 'CREATE'],
        timeRange: true,
      },
    },
    {
      pattern: /screenshots?/i,
      datasource: 'timescale',
      priority: 100,
      conditions: {
        tableNames: ['screenshots', 'monitoring.screenshots'],
        operations: ['INSERT', 'SELECT', 'CREATE'],
        timeRange: true,
      },
    },
    {
      pattern: /user_?sessions?/i,
      datasource: 'timescale',
      priority: 100,
      conditions: {
        tableNames: ['user_sessions', 'monitoring.user_sessions'],
        operations: ['INSERT', 'SELECT', 'CREATE'],
        timeRange: true,
      },
    },
    {
      pattern: /monitoring\./i,
      datasource: 'timescale',
      priority: 90,
      conditions: {
        operations: ['INSERT', 'SELECT', 'CREATE', 'UPDATE'],
      },
    },
    
    // Transactional data rules (medium priority)
    {
      pattern: /organizations?/i,
      datasource: 'postgresql',
      priority: 80,
      conditions: {
        tableNames: ['organizations'],
        operations: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
      },
    },
    {
      pattern: /users?/i,
      datasource: 'postgresql',
      priority: 80,
      conditions: {
        tableNames: ['users'],
        operations: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
      },
    },
    {
      pattern: /agents?/i,
      datasource: 'postgresql',
      priority: 80,
      conditions: {
        tableNames: ['agents'],
        operations: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
      },
    },
    {
      pattern: /policies/i,
      datasource: 'postgresql',
      priority: 80,
      conditions: {
        tableNames: ['policies'],
        operations: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
      },
    },
    {
      pattern: /api_?keys?/i,
      datasource: 'postgresql',
      priority: 80,
      conditions: {
        tableNames: ['api_keys'],
        operations: ['INSERT', 'SELECT', 'UPDATE', 'DELETE'],
      },
    },

    // DDL operations (low priority, always PostgreSQL)
    {
      pattern: /CREATE|ALTER|DROP|TRUNCATE/i,
      datasource: 'postgresql',
      priority: 50,
      conditions: {
        operations: ['CREATE', 'ALTER', 'DROP', 'TRUNCATE'],
      },
    },

    // Transaction operations (always PostgreSQL)
    {
      pattern: /BEGIN|COMMIT|ROLLBACK|SAVEPOINT/i,
      datasource: 'postgresql',
      priority: 60,
      conditions: {
        operations: ['BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT'],
      },
    },
  ];

  constructor(
    private readonly config: ConfigService,
    private readonly dualPrisma: DualPrismaService,
  ) {}

  /**
   * Determines the appropriate datasource for a given query
   */
  routeQuery(query: string, operation?: string, tableName?: string): QueryRoute {
    const startTime = Date.now();
    this.queryMetrics.totalQueries++;

    try {
      // Check if TimescaleDB is available
      const connectionHealth = this.dualPrisma.getConnectionHealth();
      const routingConfig = this.dualPrisma.getRoutingConfig();

      // If TimescaleDB is disabled, route everything to PostgreSQL
      if (!routingConfig.useTimescale) {
        this.queryMetrics.postgresQueries++;
        return {
          datasource: 'postgresql',
          reason: 'TimescaleDB disabled in configuration',
          fallbackAvailable: false,
        };
      }

      // Apply routing rules
      const matchedRule = this.findMatchingRule(query, operation, tableName);
      
      if (matchedRule) {
        // Check if the target datasource is available
        if (matchedRule.datasource === 'timescale') {
          if (connectionHealth.timescale.connected) {
            this.queryMetrics.timescaleQueries++;
            return {
              datasource: 'timescale',
              reason: `Matched rule: ${matchedRule.pattern}`,
              fallbackAvailable: routingConfig.fallbackToPostgres,
            };
          } else if (routingConfig.fallbackToPostgres) {
            this.queryMetrics.fallbackQueries++;
            return {
              datasource: 'fallback',
              reason: 'TimescaleDB unavailable, using PostgreSQL fallback',
              fallbackAvailable: true,
            };
          } else {
            throw new Error('TimescaleDB is unavailable and fallback is disabled');
          }
        } else {
          // Route to PostgreSQL
          this.queryMetrics.postgresQueries++;
          return {
            datasource: 'postgresql',
            reason: `Matched rule: ${matchedRule.pattern}`,
            fallbackAvailable: false,
          };
        }
      }

      // Default routing logic
      const defaultRoute = this.getDefaultRoute(query, operation, tableName);
      
      if (defaultRoute.datasource === 'timescale' && !connectionHealth.timescale.connected) {
        if (routingConfig.fallbackToPostgres) {
          this.queryMetrics.fallbackQueries++;
          return {
            datasource: 'fallback',
            reason: 'Default TimescaleDB route with fallback',
            fallbackAvailable: true,
          };
        }
      }

      if (defaultRoute.datasource === 'timescale') {
        this.queryMetrics.timescaleQueries++;
      } else {
        this.queryMetrics.postgresQueries++;
      }

      return defaultRoute;

    } catch (error) {
      this.logger.error(`Query routing failed: ${error.message}`);
      this.queryMetrics.postgresQueries++;
      
      // Fallback to PostgreSQL on routing errors
      return {
        datasource: 'postgresql',
        reason: `Routing error, defaulting to PostgreSQL: ${error.message}`,
        fallbackAvailable: false,
      };
    } finally {
      // Update latency metrics
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
    }
  }

  /**
   * Finds the highest priority matching routing rule
   */
  private findMatchingRule(query: string, operation?: string, tableName?: string): RoutingRule | null {
    const matchingRules = this.routingRules
      .filter(rule => this.ruleMatches(rule, query, operation, tableName))
      .sort((a, b) => b.priority - a.priority);

    return matchingRules.length > 0 ? matchingRules[0] : null;
  }

  /**
   * Checks if a routing rule matches the given query parameters
   */
  private ruleMatches(rule: RoutingRule, query: string, operation?: string, tableName?: string): boolean {
    // Check pattern match
    const patternMatches = typeof rule.pattern === 'string' 
      ? query.toLowerCase().includes(rule.pattern.toLowerCase())
      : rule.pattern.test(query);

    if (!patternMatches) {
      return false;
    }

    // Check conditions if specified
    if (rule.conditions) {
      // Check table names
      if (rule.conditions.tableNames && tableName) {
        const tableMatches = rule.conditions.tableNames.some(name => 
          tableName.toLowerCase().includes(name.toLowerCase())
        );
        if (!tableMatches) {
          return false;
        }
      }

      // Check operations
      if (rule.conditions.operations && operation) {
        const operationMatches = rule.conditions.operations.some(op => 
          operation.toLowerCase().includes(op.toLowerCase())
        );
        if (!operationMatches) {
          return false;
        }
      }

      // Check time range queries
      if (rule.conditions.timeRange) {
        const hasTimeRange = /datetime|timestamp|created_at|updated_at/i.test(query) &&
                             /WHERE|AND|OR/i.test(query);
        if (!hasTimeRange) {
          // Still allow if it's an INSERT operation for time-series data
          const isInsert = /INSERT/i.test(query) || operation?.toLowerCase() === 'insert';
          if (!isInsert) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Provides default routing logic when no rules match
   */
  private getDefaultRoute(query: string, operation?: string, tableName?: string): QueryRoute {
    // Time-series patterns
    const timeSeriesPatterns = [
      /monitoring\./i,
      /active_windows/i,
      /visited_sites/i,
      /screenshots/i,
      /user_sessions/i,
      /datetime|timestamp/i,
    ];

    const isTimeSeries = timeSeriesPatterns.some(pattern => pattern.test(query));
    
    if (isTimeSeries) {
      return {
        datasource: 'timescale',
        reason: 'Default time-series routing',
        fallbackAvailable: true,
      };
    }

    // Transactional patterns
    const transactionalPatterns = [
      /organizations/i,
      /users/i,
      /agents/i,
      /policies/i,
      /api_keys/i,
      /BEGIN|COMMIT|ROLLBACK/i,
    ];

    const isTransactional = transactionalPatterns.some(pattern => pattern.test(query));
    
    if (isTransactional) {
      return {
        datasource: 'postgresql',
        reason: 'Default transactional routing',
        fallbackAvailable: false,
      };
    }

    // Default to PostgreSQL for unknown queries
    return {
      datasource: 'postgresql',
      reason: 'Default fallback routing',
      fallbackAvailable: false,
    };
  }

  /**
   * Updates latency metrics
   */
  private updateLatencyMetrics(latency: number): void {
    const currentAvg = this.queryMetrics.averageLatency;
    const totalQueries = this.queryMetrics.totalQueries;
    
    this.queryMetrics.averageLatency = 
      ((currentAvg * (totalQueries - 1)) + latency) / totalQueries;
  }

  /**
   * Records a query error for metrics
   */
  recordQueryError(): void {
    const totalQueries = this.queryMetrics.totalQueries;
    const currentErrors = this.queryMetrics.errorRate * totalQueries;
    
    this.queryMetrics.errorRate = (currentErrors + 1) / totalQueries;
  }

  /**
   * Gets current query metrics
   */
  getQueryMetrics(): QueryMetrics {
    return { ...this.queryMetrics };
  }

  /**
   * Resets query metrics
   */
  resetMetrics(): void {
    this.queryMetrics = {
      totalQueries: 0,
      timescaleQueries: 0,
      postgresQueries: 0,
      fallbackQueries: 0,
      averageLatency: 0,
      errorRate: 0,
    };
    
    this.logger.log('Query metrics reset');
  }

  /**
   * Adds a custom routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
    this.routingRules.sort((a, b) => b.priority - a.priority);
    
    this.logger.log(`Added routing rule: ${rule.pattern} -> ${rule.datasource}`);
  }

  /**
   * Removes a routing rule by pattern
   */
  removeRoutingRule(pattern: string | RegExp): boolean {
    const initialLength = this.routingRules.length;
    
    this.routingRules = this.routingRules.filter(rule => {
      if (typeof pattern === 'string') {
        return rule.pattern.toString() !== pattern;
      } else {
        return rule.pattern.toString() !== pattern.toString();
      }
    });

    const removed = this.routingRules.length < initialLength;
    
    if (removed) {
      this.logger.log(`Removed routing rule: ${pattern}`);
    }
    
    return removed;
  }

  /**
   * Gets all current routing rules
   */
  getRoutingRules(): RoutingRule[] {
    return [...this.routingRules];
  }

  /**
   * Updates routing rule priority
   */
  updateRulePriority(pattern: string | RegExp, newPriority: number): boolean {
    const rule = this.routingRules.find(r => {
      if (typeof pattern === 'string') {
        return r.pattern.toString() === pattern;
      } else {
        return r.pattern.toString() === pattern.toString();
      }
    });

    if (rule) {
      rule.priority = newPriority;
      this.routingRules.sort((a, b) => b.priority - a.priority);
      
      this.logger.log(`Updated rule priority: ${pattern} -> ${newPriority}`);
      return true;
    }

    return false;
  }

  /**
   * Analyzes query patterns for optimization recommendations
   */
  analyzeQueryPatterns(): {
    recommendations: string[];
    hotspots: { pattern: string; count: number; avgLatency: number }[];
    efficiency: number;
  } {
    const recommendations: string[] = [];
    const hotspots: { pattern: string; count: number; avgLatency: number }[] = [];
    
    // Calculate efficiency (percentage of queries routed to optimal datasource)
    const totalQueries = this.queryMetrics.totalQueries;
    const optimalQueries = this.queryMetrics.timescaleQueries + this.queryMetrics.postgresQueries;
    const efficiency = totalQueries > 0 ? (optimalQueries / totalQueries) * 100 : 100;

    // Generate recommendations based on metrics
    if (this.queryMetrics.fallbackQueries > totalQueries * 0.1) {
      recommendations.push('High fallback usage detected. Consider TimescaleDB health monitoring.');
    }

    if (this.queryMetrics.errorRate > 0.05) {
      recommendations.push('High error rate detected. Review query routing rules.');
    }

    if (this.queryMetrics.averageLatency > 100) {
      recommendations.push('High average latency detected. Consider query optimization.');
    }

    if (efficiency < 90) {
      recommendations.push('Low routing efficiency. Review and optimize routing rules.');
    }

    return {
      recommendations,
      hotspots,
      efficiency,
    };
  }

  /**
   * Validates a query against routing rules
   */
  validateQuery(query: string, expectedDatasource?: 'postgresql' | 'timescale'): {
    valid: boolean;
    actualRoute: QueryRoute;
    issues: string[];
  } {
    const issues: string[] = [];
    const actualRoute = this.routeQuery(query);
    
    let valid = true;

    // Check if query matches expected datasource
    if (expectedDatasource && actualRoute.datasource !== expectedDatasource) {
      if (actualRoute.datasource !== 'fallback') {
        valid = false;
        issues.push(`Expected ${expectedDatasource} but routed to ${actualRoute.datasource}`);
      }
    }

    // Check for potential issues
    if (actualRoute.datasource === 'fallback') {
      issues.push('Query routed to fallback datasource');
    }

    // Check for DDL operations on TimescaleDB
    if (actualRoute.datasource === 'timescale' && /CREATE|ALTER|DROP|TRUNCATE/i.test(query)) {
      issues.push('DDL operations should not be routed to TimescaleDB');
      valid = false;
    }

    // Check for transactions on TimescaleDB
    if (actualRoute.datasource === 'timescale' && /BEGIN|COMMIT|ROLLBACK/i.test(query)) {
      issues.push('Transaction operations should not be routed to TimescaleDB');
      valid = false;
    }

    return {
      valid,
      actualRoute,
      issues,
    };
  }
}