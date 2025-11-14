import { Role } from '@prisma/client';

export { Role } from '@prisma/client';

export interface DataScope {
    organizationId?: string;
    departments?: string[];
    departmentIds?: string[];
}

export interface UserContext extends DataScope {
    sub: string;
    username: string;
    role: Role;
}
