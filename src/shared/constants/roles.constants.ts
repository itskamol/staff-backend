// Staff Control System - RBAC Role Constants
// Using simple Role-Based Access Control

import { Role } from '@prisma/client';

export const ROLE_DESCRIPTIONS = {
    [Role.ADMIN]: 'System administrator with full access to all resources',
    [Role.HR]: 'HR manager with access to organization-level employee and visitor management', 
    [Role.DEPARTMENT_LEAD]: 'Department leader with access to own department resources',
    [Role.GUARD]: 'Security guard with access to entry/exit logs and visitor management'
} as const;

// Role hierarchy for access control
export const ROLE_HIERARCHY = {
    [Role.ADMIN]: 4,        // Highest access level
    [Role.HR]: 3,           // Organization level access
    [Role.DEPARTMENT_LEAD]: 2,  // Department level access
    [Role.GUARD]: 1         // Basic access level
} as const;

// Helper function to check if user role has sufficient level
export const hasRoleAccess = (userRole: Role, requiredRole: Role): boolean => {
    return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};
