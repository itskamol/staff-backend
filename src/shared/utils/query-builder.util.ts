import { DataScope } from '../interfaces/data-scope.interface';

export class QueryBuilder {
    /**
     * Builds organization-scoped where clause
     */
    static buildOrganizationScope(scope: DataScope): { organizationId: number } {
        return {
            organizationId: scope.organizationId,
        };
    }

    /**
     * Builds branch-scoped where clause for branch managers
     */
    static buildBranchScope(scope: DataScope): any {
        return {
            organizationId: scope.organizationId,
        };
    }

    /**
     * Builds branch-scoped where clause for entities that have branch relation
     */
    static buildBranchRelationScope(scope: DataScope): any {
        return {
            organizationId: scope.organizationId,
            departmentId: scope.departments,
        };
    }

    /**
     * Builds pagination parameters
     */
    static buildPagination(page?: number, limit?: number) {
        if (!page || !limit) {
            return {};
        }

        return {
            skip: (page - 1) * limit,
            take: limit,
        };
    }

    /**
     * Builds ordering parameters
     */
    static buildOrderBy(sortBy?: string, sortOrder?: 'asc' | 'desc') {
        if (!sortBy) {
            return { createdAt: 'desc' };
        }

        return {
            [sortBy]: sortOrder || 'asc',
        };
    }
}
