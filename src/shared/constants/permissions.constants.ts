/**
 * Permission naming convention:
 * - :all - Access to all resources of this type across the organization
 * - :managed - Access to resources within user's managed scope (branches for BRANCH_MANAGER)
 * - :self - Access only to user's own resources
 * - :org - Access to organization-level resources
 * - :branch - Access to branch-level resources
 * - :system - System-level administrative access
 */

export const PERMISSIONS = {
    // Organization permissions
    ORGANIZATION: {
        CREATE: 'organization:create',
        READ_ALL: 'organization:read:all',
        READ_SELF: 'organization:read:self',
        UPDATE_SELF: 'organization:update:self',
    },

    // User management permissions
    USER: {
        CREATE_ORG_ADMIN: 'user:create:org_admin',
        MANAGE_ORG: 'user:manage:org',
    },

    // Branch permissions
    BRANCH: {
        CREATE: 'branch:create',
        READ_ALL: 'branch:read:all',
        UPDATE_MANAGED: 'branch:update:managed',
    },

    // Department permissions
    DEPARTMENT: {
        CREATE: 'department:create',
        MANAGE_ALL: 'department:manage:all',
    },

    // Employee permissions
    EMPLOYEE: {
        CREATE: 'employee:create',
        READ_ALL: 'employee:read:all',
        READ_SELF: 'employee:read:self',
        UPDATE_ALL: 'employee:update:all',
        UPDATE_MANAGED: 'employee:update:managed',
        DELETE: 'employee:delete',
    },

    // Device permissions
    DEVICE: {
        CREATE: 'device:create',
        READ_ALL: 'device:read:all',
        MANAGE_ALL: 'device:manage:all',
        UPDATE_MANAGED: 'device:update:managed',
        MANAGE_MANAGED: 'device:manage:managed',
    },

    // Guest permissions
    GUEST: {
        CREATE: 'guest:create',
        READ_ALL: 'guest:read:all',
        UPDATE_MANAGED: 'guest:update:managed',
        MANAGE: 'guest:manage',
        APPROVE: 'guest:approve',
    },

    // Attendance permissions
    ATTENDANCE: {
        CREATE: 'attendance:create',
        READ_ALL: 'attendance:read:all',
        DELETE_MANAGED: 'attendance:delete:managed',
    },

    // Report permissions
    REPORT: {
        CREATE: 'report:create',
        GENERATE_ORG: 'report:generate:org',
        GENERATE_BRANCH: 'report:generate:branch',
        READ_ALL: 'report:read:all',
        DOWNLOAD: 'report:download',
    },

    // Audit permissions
    AUDIT: {
        READ_ORG: 'audit:read:org',
        READ_SYSTEM: 'audit:read:system',
        READ_ALL: 'audit:read:all',
        READ_SECURITY: 'audit:read:security',
        ADMIN: 'audit:admin',
        EXPORT: 'audit:export',
    },

    // Admin permissions
    ADMIN: {
        QUEUE_READ: 'admin:queue:read',
        QUEUE_MANAGE: 'admin:queue:manage',
        SYSTEM_MANAGE: 'admin:system:manage',
    },
} as const;

// Helper function to get all permission values as array
export const getAllPermissions = (): string[] => {
    const permissions: string[] = [];

    const extractPermissions = <T extends Record<string, unknown>>(obj: T): void => {
        for (const key in obj) {
            if (typeof obj[key] === 'string') {
                permissions.push(obj[key] as string);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                extractPermissions(obj[key] as Record<string, unknown>);
            }
        }
    };

    extractPermissions(PERMISSIONS);
    return permissions;
};

// Type for all possible permissions
export type Permission =
    (typeof PERMISSIONS)[keyof typeof PERMISSIONS][keyof (typeof PERMISSIONS)[keyof typeof PERMISSIONS]];
