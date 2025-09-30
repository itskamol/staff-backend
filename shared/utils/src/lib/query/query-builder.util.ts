export interface DataScope {
    organizationId?: number;
    departments?: number[];
}

export interface QueryOptions {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    filters?: Record<string, any>;
}

export class QueryBuilderUtil {
    static buildQuery(options: QueryOptions, dataScope?: DataScope) {
        const { page = 1, limit = 10, sort, order = 'asc', search, filters = {} } = options;

        // Build where clause
        const where: Record<string, any> = {};

        // Apply data scoping
        if (dataScope) {
            if (dataScope.organizationId) {
                where['organizationId'] = dataScope.organizationId;
            }
            if (dataScope.departments && dataScope.departments.length > 0) {
                where['departmentId'] = {
                    in: dataScope.departments,
                };
            }
        }

        // Apply search
        if (search) {
            where['OR'] = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                if (Array.isArray(value)) {
                    where[key] = { in: value };
                } else if (typeof value === 'boolean') {
                    where[key] = value;
                } else {
                    where[key] = value;
                }
            }
        });

        // Build pagination
        const skip = (page - 1) * limit;
        const take = Math.min(100, limit); // Max 100 records per page

        // Build order by
        const orderBy = sort ? { [sort]: order as 'asc' | 'desc' } : { createdAt: 'desc' as const };

        return {
            where,
            skip,
            take,
            orderBy,
        };
    }

    static buildResponse<T>(data: T[], total: number, page: number, limit: number) {
        return {
            data,
            page,
            total,
            limit,
        };
    }
}
