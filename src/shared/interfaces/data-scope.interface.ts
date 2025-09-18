import { Role } from "@prisma/client";

export interface DataScope {
    organizationId: number;
    departmentId?: number;
}

export interface UserContext {
    sub: string;
    username: string;
    role: Role;
}
