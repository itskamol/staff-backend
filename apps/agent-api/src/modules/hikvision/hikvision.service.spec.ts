import { Test, TestingModule } from '@nestjs/testing';
import { HIKVisionService } from './hikvision.service';
import { PrismaService } from '@app/shared/database';
import {
    HIKVisionActionType,
    HIKVisionEventType,
    HIKVisionDeviceStatus,
} from './dto/hikvision.dto';
import { ActionType, EntryType, ActionMode, VisitorType } from '@prisma/client';

describe('HIKVisionService', () => {
    let service: HIKVisionService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        device: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        employee: {
            findFirst: jest.fn(),
        },
        visitor: {
            findFirst: jest.fn(),
        },
        credential: {
            findFirst: jest.fn(),
        },
        action: {
            create: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HIKVisionService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<HIKVisionService>(HIKVisionService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('processAction', () => {
        it('should process HIKVision action successfully', async () => {
            const actionDto = {
                deviceIp: '192.168.1.100',
                deviceSerial: 'HK001',
                actionType: HIKVisionActionType.FACE_RECOGNITION,
                timestamp: '2024-01-15T09:30:00Z',
                accessGranted: true,
                personInfo: {
                    personId: 'P001',
                    name: 'John Doe',
                    employeeId: '1',
                },
            };

            const mockDevice = {
                id: 1,
                name: 'Main Gate Device',
                gateId: 1,
                gate: { id: 1, name: 'Main Gate' },
            };

            const mockEmployee = {
                id: 1,
                name: 'John Doe',
            };

            const mockAction = {
                id: 1,
                deviceId: 1,
                gateId: 1,
                employeeId: 1,
                actionTime: new Date(actionDto.timestamp),
            };

            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);
            mockPrismaService.employee.findFirst.mockResolvedValue(mockEmployee);
            mockPrismaService.action.create.mockResolvedValue(mockAction);

            const result = await service.processAction(actionDto);

            expect(result.processed).toBe(true);
            expect(result.deviceMatched).toBe(true);
            expect(result.personMatched).toBe(true);
            expect(result.actionRecorded).toBe(true);
            expect(result.errors).toHaveLength(0);

            expect(mockPrismaService.action.create).toHaveBeenCalledWith({
                data: {
                    deviceId: mockDevice.id,
                    gateId: mockDevice.gateId,
                    actionTime: new Date(actionDto.timestamp),
                    employeeId: mockEmployee.id,
                    visitorId: null,
                    visitorType: VisitorType.EMPLOYEE,
                    entryType: EntryType.ENTER,
                    actionType: ActionType.PHOTO,
                    actionResult: 'SUCCESS',
                    actionMode: ActionMode.ONLINE,
                },
            });
        });

        it('should handle device not found', async () => {
            const actionDto = {
                deviceIp: '192.168.1.999',
                deviceSerial: 'HK999',
                actionType: HIKVisionActionType.CARD_SWIPE,
                timestamp: '2024-01-15T09:30:00Z',
                accessGranted: false,
            };

            mockPrismaService.device.findFirst.mockResolvedValue(null);

            const result = await service.processAction(actionDto);

            expect(result.processed).toBe(false);
            expect(result.deviceMatched).toBe(false);
            expect(result.errors).toContain('Device not found for IP: 192.168.1.999');
        });

        it('should handle person not matched', async () => {
            const actionDto = {
                deviceIp: '192.168.1.100',
                deviceSerial: 'HK001',
                actionType: HIKVisionActionType.FACE_RECOGNITION,
                timestamp: '2024-01-15T09:30:00Z',
                accessGranted: true,
                personInfo: {
                    personId: 'P999',
                    name: 'Unknown Person',
                },
            };

            const mockDevice = {
                id: 1,
                name: 'Main Gate Device',
                gateId: 1,
            };

            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);
            mockPrismaService.employee.findFirst.mockResolvedValue(null);
            mockPrismaService.visitor.findFirst.mockResolvedValue(null);
            mockPrismaService.credential.findFirst.mockResolvedValue(null);
            mockPrismaService.action.create.mockResolvedValue({ id: 1 });

            const result = await service.processAction(actionDto);

            expect(result.processed).toBe(true);
            expect(result.deviceMatched).toBe(true);
            expect(result.personMatched).toBe(false);
            expect(result.actionRecorded).toBe(true);
        });
    });

    describe('processBatchActions', () => {
        it('should process multiple actions', async () => {
            const batchDto = {
                actions: [
                    {
                        deviceIp: '192.168.1.100',
                        deviceSerial: 'HK001',
                        actionType: HIKVisionActionType.FACE_RECOGNITION,
                        timestamp: '2024-01-15T09:30:00Z',
                        accessGranted: true,
                    },
                    {
                        deviceIp: '192.168.1.101',
                        deviceSerial: 'HK002',
                        actionType: HIKVisionActionType.CARD_SWIPE,
                        timestamp: '2024-01-15T09:31:00Z',
                        accessGranted: false,
                    },
                ],
            };

            const mockDevice = { id: 1, gateId: 1 };
            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);
            mockPrismaService.action.create.mockResolvedValue({ id: 1 });

            const results = await service.processBatchActions(batchDto);

            expect(results).toHaveLength(2);
            expect(results[0].processed).toBe(true);
            expect(results[1].processed).toBe(true);
        });
    });

    describe('processEvent', () => {
        it('should process HIKVision event successfully', async () => {
            const eventDto = {
                deviceIp: '192.168.1.100',
                deviceSerial: 'HK001',
                eventType: HIKVisionEventType.DOOR_OPENED,
                timestamp: '2024-01-15T09:30:00Z',
                description: 'Main door opened',
            };

            const mockDevice = {
                id: 1,
                name: 'Main Gate Device',
                gateId: 1,
            };

            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);

            const result = await service.processEvent(eventDto);

            expect(result.processed).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should handle security events with alerts', async () => {
            const eventDto = {
                deviceIp: '192.168.1.100',
                deviceSerial: 'HK001',
                eventType: HIKVisionEventType.ALARM_TRIGGERED,
                timestamp: '2024-01-15T09:30:00Z',
                description: 'Security alarm triggered',
                severity: 5,
            };

            const mockDevice = {
                id: 1,
                name: 'Main Gate Device',
                gateId: 1,
            };

            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);

            const result = await service.processEvent(eventDto);

            expect(result.processed).toBe(true);
            expect(result.alertGenerated).toBe(true);
        });
    });

    describe('processDeviceStatus', () => {
        it('should process device status update', async () => {
            const statusDto = {
                deviceIp: '192.168.1.100',
                deviceSerial: 'HK001',
                status: HIKVisionDeviceStatus.ONLINE,
                timestamp: '2024-01-15T09:30:00Z',
                deviceName: 'Main Gate Device',
                cpuUsage: 45,
                memoryUsage: 60,
            };

            const mockDevice = {
                id: 1,
                name: 'Main Gate Device',
                gateId: 1,
            };

            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);

            const result = await service.processDeviceStatus(statusDto);

            expect(result.statusUpdated).toBe(true);
            expect(result.deviceIp).toBe(statusDto.deviceIp);
            expect(result.errors).toHaveLength(0);
        });

        it('should generate alerts for offline devices', async () => {
            const statusDto = {
                deviceIp: '192.168.1.100',
                deviceSerial: 'HK001',
                status: HIKVisionDeviceStatus.OFFLINE,
                timestamp: '2024-01-15T09:30:00Z',
            };

            const mockDevice = {
                id: 1,
                name: 'Main Gate Device',
                gateId: 1,
            };

            mockPrismaService.device.findFirst.mockResolvedValue(mockDevice);

            const result = await service.processDeviceStatus(statusDto);

            expect(result.statusUpdated).toBe(true);
            expect(result.alertsGenerated).toBe(1);
        });
    });
});
