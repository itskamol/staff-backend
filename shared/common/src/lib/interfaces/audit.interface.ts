export interface CreateAuditLogData {
    action: string;
    resource: string;
    resourceId?: string;
    userId?: string;
    organizationId?: string;
    method: string;
    url: string;
    userAgent?: string;
    ipAddress?: string;
    requestData?: any;
    responseData?: any;
    status: string;
    duration: number;
    timestamp: Date;
    errorMessage?: string;
    errorStack?: string;
    oldValues?: any;
    newValues?: any;
}