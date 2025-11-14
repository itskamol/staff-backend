import { Role } from "@app/shared/auth";

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
