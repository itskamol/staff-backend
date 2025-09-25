import { Role } from '@prisma/client';

export interface DataScope {
    organizationId?: number;
    departments?: number[];
}

export interface UserContext extends DataScope {
    sub: string;
    username: string;
    role: Role;
}
