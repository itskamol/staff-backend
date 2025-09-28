import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import { ReportType, TimeRange } from './dto/reports.dto';

describe('ReportsService', () => {
    let service: ReportsService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        action: {
            groupBy: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        employee: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        device: {
            findMany: jest.fn(),
        },
        visitor: {
            findMany: jest.fn(),
        },
        department: {
            findMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportsService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<ReportsService>(ReportsService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('generateReport', () => {
        it('should generate attendance report', async () => {
            const generateReportDto = {
                reportType: ReportType.ATTENDANCE,
                timeRange: TimeRange.THIS_MONTH,
            };

            const user = {
                id: 1,
                role: Role.HR,
                organizationId: 1,
                name: 'Test User',
            };

            mockPrismaService.action.groupBy.mockResolvedValue([
                { employeeId: 1, _count: { id: 10 } },
            ]);

            mockPrismaService.employee.findUnique.mockResolvedValue({
                id: 1,
                name: 'John Doe',
                department: { fullName: 'IT Department' },
            });

            mockPrismaService.action.findMany.mockResolvedValue([
                {
                    employeeId: 1,
                    entryType: 'ENTER',
                    actionTime: new Date('2024-01-15T09:00:00Z'),
                },
            ]);

            const result = await service.generateReport(generateReportDto, user);

            expect(result).toHaveProperty('reportType');
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('generatedAt');
            expect(result.reportType).toBe(ReportType.ATTENDANCE);
        });
    });

    describe('generateAttendanceReport', () => {
        it('should generate attendance report data', async () => {
            const dto = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                departmentId: 1,
            };

            const user = {
                id: 1,
                role: Role.HR,
                organizationId: 1,
            };

            mockPrismaService.action.groupBy.mockResolvedValue([
                { employeeId: 1, _count: { id: 20 } },
            ]);

            mockPrismaService.employee.findUnique.mockResolvedValue({
                id: 1,
                name: 'John Doe',
                department: { fullName: 'IT Department' },
            });

            mockPrismaService.action.findMany.mockResolvedValue([
                {
                    employeeId: 1,
                    entryType: 'ENTER',
                    actionTime: new Date('2024-01-15T09:00:00Z'),
                },
                {
                    employeeId: 1,
                    entryType: 'ENTER',
                    actionTime: new Date('2024-01-16T09:00:00Z'),
                },
            ]);

            const result = await service.generateAttendanceReport(dto, user);

            expect(result).toBeInstanceOf(Array);
            expect(result[0]).toHaveProperty('employeeId');
            expect(result[0]).toHaveProperty('employeeName');
            expect(result[0]).toHaveProperty('attendancePercentage');
        });
    });

    describe('generateProductivityReport', () => {
        it('should generate productivity report data', async () => {
            const dto = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                employeeIds: [1],
            };

            const user = {
                id: 1,
                role: Role.HR,
                organizationId: 1,
            };

            mockPrismaService.employee.findMany.mockResolvedValue([
                {
                    id: 1,
                    name: 'John Doe',
                    department: { fullName: 'IT Department' },
                    computerUsers: [
                        {
                            usersOnComputers: [
                                {
                                    activeWindows: [
                                        {
                                            processName: 'chrome.exe',
                                            activeTime: 3600,
                                        },
                                    ],
                                    visitedSites: [
                                        {
                                            url: 'https://google.com',
                                            activeTime: 1800,
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ]);

            const result = await service.generateProductivityReport(dto, user);

            expect(result).toBeInstanceOf(Array);
            expect(result[0]).toHaveProperty('employeeId');
            expect(result[0]).toHaveProperty('productivityPercentage');
            expect(result[0]).toHaveProperty('topApplications');
            expect(result[0]).toHaveProperty('topWebsites');
        });
    });

    describe('generateDeviceUsageReport', () => {
        it('should generate device usage report data', async () => {
            const dto = {
                startDate: '2024-01-01',
                endDate: '2024-01-31',
            };

            const user = {
                id: 1,
                role: Role.HR,
                organizationId: 1,
            };

            mockPrismaService.device.findMany.mockResolvedValue([
                {
                    id: 1,
                    name: 'Main Gate Device',
                    gate: { name: 'Main Gate' },
                    actions: [
                        {
                            entryType: 'ENTER',
                            actionTime: new Date('2024-01-15T09:00:00Z'),
                        },
                        {
                            entryType: 'EXIT',
                            actionTime: new Date('2024-01-15T17:00:00Z'),
                        },
                    ],
                },
            ]);

            const result = await service.generateDeviceUsageReport(dto, user);

            expect(result).toBeInstanceOf(Array);
            expect(result[0]).toHaveProperty('deviceId');
            expect(result[0]).toHaveProperty('totalEntries');
            expect(result[0]).toHaveProperty('totalExits');
            expect(result[0]).toHaveProperty('usageByHour');
        });
    });
});
