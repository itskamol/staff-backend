import { DeviceAdapter, DeviceCommandContext, DeviceCommandRequest, DeviceCommandResult } from '../device-adapter.interface';

export class LoggingAdapter implements DeviceAdapter {
    readonly type = 'generic';
    readonly vendor = 'logger';

    async executeCommand(
        request: DeviceCommandRequest,
        context: DeviceCommandContext
    ): Promise<DeviceCommandResult> {
        const info = {
            request,
            context,
            executedAt: new Date().toISOString(),
        };

        // eslint-disable-next-line no-console
        console.info('[LoggingAdapter] Simulated command execution', info);

        return {
            success: true,
            message: 'Command accepted (simulated)',
            data: info,
        };
    }
}
