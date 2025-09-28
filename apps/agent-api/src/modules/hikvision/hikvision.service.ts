import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import {
    HIKVisionActionDto,
    HIKVisionEventDto,
    HIKVisionDeviceStatusDto,
    HIKVisionBatchActionDto,
    HIKVisionBatchEventDto,
    HIKVisionBatchDeviceStatusDto,
    HIKVisionActionResponse,
    HIKVisionEventResponse,
    HIKVisionDeviceStatusResponse,
    HIKVisionActionType,
    HIKVisionEventType,
    HIKVisionDeviceStatus,
} from './dto/hikvision.dto';
import { ActionType, EntryType, ActionMode, VisitorType } from '@prisma/client';

@Injectable()
export class HIKVisionService {
    private readonly logger = new Logger(HIKVisionService.name);

    constructor(private readonly prisma: PrismaService) {}

    async processAction(actionDto: HIKVisionActionDto): Promise<HIKVisionActionResponse> {
        const response: HIKVisionActionResponse = {
            id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            processed: false,
            deviceMatched: false,
            personMatched: false,
            actionRecorded: false,
            errors: [],
        };

        try {
            this.logger.debug(`Processing HIKVision action from device ${actionDto.deviceIp}`);

            // Find device by IP address
            const device = await this.findDeviceByIp(actionDto.deviceIp);
            if (!device) {
                response.errors?.push(`Device not found for IP: ${actionDto.deviceIp}`);
                return response;
            }
            response.deviceMatched = true;

            // Try to match person
            let employeeId: number | null = null;
            let visitorId: number | null = null;
            let visitorType: VisitorType = VisitorType.VISITOR;

            if (actionDto.personInfo) {
                const personMatch = await this.matchPerson(actionDto.personInfo);
                if (personMatch.employee) {
                    employeeId = personMatch.employee.id;
                    visitorType = VisitorType.EMPLOYEE;
                    response.personMatched = true;
                } else if (personMatch.visitor) {
                    visitorId = personMatch.visitor.id;
                    visitorType = VisitorType.VISITOR;
                    response.personMatched = true;
                }
            }

            // Convert HIKVision action type to system action type
            const actionType = this.mapHIKVisionActionType(actionDto.actionType);

            // Determine entry type based on access granted and door configuration
            const entryType = actionDto.accessGranted ? EntryType.ENTER : EntryType.EXIT;

            // Record action in database
            const action = await this.prisma.action.create({
                data: {
                    deviceId: device.id,
                    gateId: device.gateId,
                    actionTime: new Date(actionDto.timestamp),
                    employeeId,
                    visitorId,
                    visitorType,
                    entryType,
                    actionType,
                    actionResult: actionDto.accessGranted ? 'SUCCESS' : 'DENIED',
                    actionMode: ActionMode.ONLINE,
                },
            });

            response.actionRecorded = true;
            response.processed = true;

            this.logger.log(`HIKVision action processed successfully: ${response.id}`);

            // Generate alerts for denied access
            if (!actionDto.accessGranted) {
                await this.generateSecurityAlert(actionDto, device);
            }
        } catch (error) {
            this.logger.error(`Error processing HIKVision action: ${error.message}`, error.stack);
            response.errors?.push(`Processing error: ${error.message}`);
        }

        return response;
    }

    async processBatchActions(
        batchDto: HIKVisionBatchActionDto
    ): Promise<HIKVisionActionResponse[]> {
        this.logger.debug(`Processing batch of ${batchDto.actions.length} HIKVision actions`);

        const responses: HIKVisionActionResponse[] = [];

        for (const action of batchDto.actions) {
            const response = await this.processAction(action);
            responses.push(response);
        }

        const successCount = responses.filter(r => r.processed).length;
        this.logger.log(
            `Batch processing completed: ${successCount}/${batchDto.actions.length} actions processed successfully`
        );

        return responses;
    }

    async processEvent(eventDto: HIKVisionEventDto): Promise<HIKVisionEventResponse> {
        const response: HIKVisionEventResponse = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            processed: false,
            alertGenerated: false,
            notificationSent: false,
            errors: [],
        };

        try {
            this.logger.debug(
                `Processing HIKVision event: ${eventDto.eventType} from device ${eventDto.deviceIp}`
            );

            // Find device
            const device = await this.findDeviceByIp(eventDto.deviceIp);
            if (!device) {
                response.errors?.push(`Device not found for IP: ${eventDto.deviceIp}`);
                return response;
            }

            // Process different event types
            switch (eventDto.eventType) {
                case HIKVisionEventType.ALARM_TRIGGERED:
                case HIKVisionEventType.TAMPER_DETECTED:
                    await this.handleSecurityEvent(eventDto, device);
                    response.alertGenerated = true;
                    break;

                case HIKVisionEventType.DEVICE_OFFLINE:
                case HIKVisionEventType.DEVICE_ONLINE:
                    await this.handleDeviceStatusEvent(eventDto, device);
                    break;

                case HIKVisionEventType.ACCESS_DENIED:
                    await this.handleAccessDeniedEvent(eventDto, device);
                    response.alertGenerated = true;
                    break;

                default:
                    this.logger.debug(
                        `Event type ${eventDto.eventType} processed without special handling`
                    );
            }

            response.processed = true;
            this.logger.log(`HIKVision event processed successfully: ${response.id}`);
        } catch (error) {
            this.logger.error(`Error processing HIKVision event: ${error.message}`, error.stack);
            response.errors?.push(`Processing error: ${error.message}`);
        }

        return response;
    }

    async processBatchEvents(batchDto: HIKVisionBatchEventDto): Promise<HIKVisionEventResponse[]> {
        this.logger.debug(`Processing batch of ${batchDto.events.length} HIKVision events`);

        const responses: HIKVisionEventResponse[] = [];

        for (const event of batchDto.events) {
            const response = await this.processEvent(event);
            responses.push(response);
        }

        const successCount = responses.filter(r => r.processed).length;
        this.logger.log(
            `Batch event processing completed: ${successCount}/${batchDto.events.length} events processed successfully`
        );

        return responses;
    }

    async processDeviceStatus(
        statusDto: HIKVisionDeviceStatusDto
    ): Promise<HIKVisionDeviceStatusResponse> {
        const response: HIKVisionDeviceStatusResponse = {
            deviceIp: statusDto.deviceIp,
            statusUpdated: false,
            alertsGenerated: 0,
            errors: [],
        };

        try {
            this.logger.debug(`Processing device status update for ${statusDto.deviceIp}`);

            // Find or create device record
            let device = await this.findDeviceByIp(statusDto.deviceIp);

            if (!device) {
                // Create device record if it doesn't exist
                device = await this.createDeviceFromStatus(statusDto);
            }

            // Update device status (you might want to add status fields to Device model)
            // For now, we'll log the status and generate alerts if needed

            if (
                statusDto.status === HIKVisionDeviceStatus.OFFLINE ||
                statusDto.status === HIKVisionDeviceStatus.ERROR
            ) {
                await this.generateDeviceAlert(statusDto, device);
                response.alertsGenerated++;
            }

            response.statusUpdated = true;
            this.logger.log(`Device status updated for ${statusDto.deviceIp}: ${statusDto.status}`);
        } catch (error) {
            this.logger.error(`Error processing device status: ${error.message}`, error.stack);
            response.errors?.push(`Processing error: ${error.message}`);
        }

        return response;
    }

    async processBatchDeviceStatus(
        batchDto: HIKVisionBatchDeviceStatusDto
    ): Promise<HIKVisionDeviceStatusResponse[]> {
        this.logger.debug(`Processing batch of ${batchDto.devices.length} device status updates`);

        const responses: HIKVisionDeviceStatusResponse[] = [];

        for (const deviceStatus of batchDto.devices) {
            const response = await this.processDeviceStatus(deviceStatus);
            responses.push(response);
        }

        const successCount = responses.filter(r => r.statusUpdated).length;
        this.logger.log(
            `Batch device status processing completed: ${successCount}/${batchDto.devices.length} devices processed successfully`
        );

        return responses;
    }

    private async findDeviceByIp(ipAddress: string) {
        return this.prisma.device.findFirst({
            where: { ipAddress },
            include: {
                gate: true,
            },
        });
    }

    private async matchPerson(personInfo: any) {
        let employee = null;
        let visitor = null;

        // Try to match by employee ID first
        if (personInfo.employeeId) {
            employee = await this.prisma.employee.findFirst({
                where: {
                    OR: [
                        { id: parseInt(personInfo.employeeId) },
                        { name: { contains: personInfo.name, mode: 'insensitive' } },
                    ],
                },
            });
        }

        // Try to match by card number
        if (!employee && personInfo.cardNumber) {
            const credential = await this.prisma.credential.findFirst({
                where: {
                    code: personInfo.cardNumber,
                    type: ActionType.CARD,
                },
                include: { employee: true },
            });
            employee = credential?.employee;
        }

        // Try to match visitor by name or code
        if (!employee && personInfo.name) {
            visitor = await this.prisma.visitor.findFirst({
                where: {
                    OR: [
                        {
                            AND: [
                                {
                                    firstName: {
                                        contains: personInfo.name.split(' ')[0],
                                        mode: 'insensitive',
                                    },
                                },
                                {
                                    lastName: {
                                        contains: personInfo.name.split(' ')[1] || '',
                                        mode: 'insensitive',
                                    },
                                },
                            ],
                        },
                    ],
                },
            });
        }

        return { employee, visitor };
    }

    private mapHIKVisionActionType(hikVisionType: HIKVisionActionType): ActionType {
        const mapping = {
            [HIKVisionActionType.FACE_RECOGNITION]: ActionType.PHOTO,
            [HIKVisionActionType.CARD_SWIPE]: ActionType.CARD,
            [HIKVisionActionType.FINGERPRINT]: ActionType.PERSONAL_CODE,
            [HIKVisionActionType.PASSWORD]: ActionType.PERSONAL_CODE,
            [HIKVisionActionType.QR_CODE]: ActionType.QR,
            [HIKVisionActionType.REMOTE_OPEN]: ActionType.USER,
        };

        return mapping[hikVisionType] || ActionType.USER;
    }

    private async generateSecurityAlert(actionDto: HIKVisionActionDto, device: any) {
        this.logger.warn(
            `Security Alert: Access denied at device ${device.name} (${actionDto.deviceIp})`
        );

        // TODO: Implement actual alert generation
        // This could involve:
        // - Sending notifications to security personnel
        // - Creating alert records in database
        // - Triggering automated responses
    }

    private async handleSecurityEvent(eventDto: HIKVisionEventDto, device: any) {
        this.logger.warn(`Security Event: ${eventDto.eventType} at device ${device.name}`);

        // TODO: Implement security event handling
        // - Log security events
        // - Generate alerts
        // - Notify security team
    }

    private async handleDeviceStatusEvent(eventDto: HIKVisionEventDto, device: any) {
        this.logger.log(`Device Status Event: ${eventDto.eventType} for device ${device.name}`);

        // TODO: Update device status in database
        // - Track device uptime/downtime
        // - Generate maintenance alerts
    }

    private async handleAccessDeniedEvent(eventDto: HIKVisionEventDto, device: any) {
        this.logger.warn(`Access Denied Event at device ${device.name}`);

        // TODO: Handle access denied events
        // - Log unauthorized access attempts
        // - Generate security alerts
        // - Track patterns of denied access
    }

    private async createDeviceFromStatus(statusDto: HIKVisionDeviceStatusDto) {
        // TODO: Implement device auto-registration
        // For now, return null to indicate device not found
        this.logger.warn(`Device auto-registration not implemented for ${statusDto.deviceIp}`);
        return null;
    }

    private async generateDeviceAlert(statusDto: HIKVisionDeviceStatusDto, device: any) {
        this.logger.warn(
            `Device Alert: ${device?.name || statusDto.deviceIp} status is ${statusDto.status}`
        );

        // TODO: Implement device alert generation
        // - Create maintenance tickets
        // - Notify IT team
        // - Track device health metrics
    }
}
