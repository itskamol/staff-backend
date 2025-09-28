export class DatabaseUtil {
    static buildWhereClause(filters: Record<string, any>): Record<string, any> {
        const where: Record<string, any> = {};

        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                if (typeof value === 'string' && key.includes('search')) {
                    where[key.replace('search', '')] = {
                        contains: value,
                        mode: 'insensitive',
                    };
                } else if (typeof value === 'boolean') {
                    where[key] = value;
                } else if (Array.isArray(value) && value.length > 0) {
                    where[key] = {
                        in: value,
                    };
                } else {
                    where[key] = value;
                }
            }
        });

        return where;
    }

    static buildOrderBy(sort?: string, order?: 'asc' | 'desc'): Record<string, any> | undefined {
        if (!sort) return undefined;

        return {
            [sort]: order || 'asc',
        };
    }

    static buildPagination(page?: number, limit?: number) {
        const pageNum = Math.max(1, page || 1);
        const limitNum = Math.min(100, Math.max(1, limit || 10));

        return {
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
            page: pageNum,
            limit: limitNum,
        };
    }

    static calculateTotalPages(totalRecords: number, limit: number): number {
        return Math.ceil(totalRecords / limit);
    }
}
