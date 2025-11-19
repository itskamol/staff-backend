import { Role } from '@prisma/client';

export { Role }

export interface DataScope {
    organizationId?: number;
    departments?: number[];
    departmentIds?: number[];
}

export interface UserContext extends DataScope {
    sub: string;
    username: string;
    role: Role;
}
