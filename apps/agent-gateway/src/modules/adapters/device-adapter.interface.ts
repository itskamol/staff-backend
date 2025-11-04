export interface DeviceCommandContext {
    gatewayId: string;
    organizationId?: number;
    correlationId?: string;
}

export interface DeviceCommandRequest {
    deviceId: string;
    command: string;
    payload: Record<string, unknown>;
}

export interface DeviceCommandResult {
    success: boolean;
    message?: string;
    data?: Record<string, unknown>;
}

export interface DeviceAdapter {
    readonly type: string;
    readonly vendor: string;

    executeCommand(
        request: DeviceCommandRequest,
        context: DeviceCommandContext
    ): Promise<DeviceCommandResult>;
}
