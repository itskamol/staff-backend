import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

interface DeviceInfo {
    id: string;
    signature: string;
    timestamp?: string;
    authenticated: boolean;
}

interface RequestWithDevice extends Request {
    device?: DeviceInfo;
}

@Injectable()
export class DeviceAuthGuard implements CanActivate {
    private readonly TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
    private readonly DEV_SIGNATURE_PREFIX = 'dev-';

    constructor(private reflector: Reflector) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<RequestWithDevice>();

        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        // Get device authentication headers
        const deviceId = request.headers['x-device-id'] as string;
        const signature = request.headers['x-device-signature'] as string;
        const timestamp = request.headers['x-timestamp'] as string;

        if (!deviceId) {
            throw new UnauthorizedException('Device ID is required');
        }

        if (!signature) {
            throw new UnauthorizedException('Device signature is required');
        }

        // Validate timestamp if provided (prevent replay attacks)
        if (timestamp && typeof timestamp === 'string') {
            const requestTime = new Date(timestamp);
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - requestTime.getTime());

            // Allow configured tolerance time
            if (timeDiff > this.TIMESTAMP_TOLERANCE_MS) {
                throw new UnauthorizedException('Request timestamp is too old');
            }
        }

        // Basic signature validation (in real implementation, this would be more sophisticated)
        if (!this.isValidSignature(deviceId, signature, request.body, timestamp)) {
            throw new UnauthorizedException('Invalid device signature');
        }

        // Add device info to request for use in controllers
        request.device = {
            id: deviceId,
            signature,
            timestamp,
            authenticated: true,
        };

        return true;
    }

    private isValidSignature(
        deviceId: string,
        signature: string,
        body: any,
        timestamp?: string
    ): boolean {
        // In a real implementation, this would:
        // 1. Look up the device's shared secret or public key
        // 2. Recreate the expected signature using the same algorithm
        // 3. Compare with the provided signature

        // For development/testing, allow signatures starting with configured prefix
        if (signature.startsWith(this.DEV_SIGNATURE_PREFIX)) {
            return true;
        }

        // Mock validation - in production this would be much more secure
        const crypto = require('crypto');
        const payload = JSON.stringify({
            deviceId,
            body,
            timestamp,
        });

        const expectedSignature = crypto
            .createHash('sha256')
            .update(`${payload}mock-device-secret`)
            .digest('hex')
            .substring(0, 32);

        return signature === expectedSignature;
    }
}