import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { VisitorService } from './visitor.service';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import { VisitorCodeType } from '@prisma/client';

describe('VisitorService', () => {
    let service: VisitorService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        visitor: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
        },
        onetimeCode: {
            create: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            deleteMany: jest.fn(),
        },
        action: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VisitorService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<VisitorService>(VisitorService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create a visitor successfully', async () => {
            const createVisitorDto = {
                firstName: 'John',
                lastName: 'Doe',
                phone: '+998901234567',
                workPlace: 'Test Company',
            };

            const user = { id: 1, role: Role.HR, organizationId: 1 };

            const expectedResult = {
                id: 1,
                ...createVisitorDto,
                createdAt: new Date(),
                creator: { id: 1, name: 'Test User' },
            };

            mockPrismaService.visitor.create.mockResolvedValue(expectedResult);

            const result = await service.create(createVisitorDto, user);

            expect(result).toEqual(expectedResult);
            expect(mockPrismaService.visitor.create).toHaveBeenCalledWith({
                data: {
                    ...createVisitorDto,
                    creatorId: user.id,
                },
                select: expect.any(Object),
            });
        });
    });

    describe('generateCode', () => {
        it('should generate a visitor code with QR code', async () => {
            const visitorId = 1;
            const generateCodeDto = {
                codeType: VisitorCodeType.ONETIME,
                startDate: '2024-01-01T09:00:00Z',
                endDate: '2024-01-01T18:00:00Z',
                additionalDetails: 'Test visit',
            };

            const user = { id: 1, role: Role.HR, organizationId: 1 };

            const mockVisitor = {
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                creator: { organizationId: 1 },
            };

            const mockOnetimeCode = {
                id: 1,
                codeType: VisitorCodeType.ONETIME,
                code: 'ABC12345',
                startDate: new Date('2024-01-01T09:00:00Z'),
                endDate: new Date('2024-01-01T18:00:00Z'),
                isActive: true,
                createdAt: new Date(),
                visitor: {
                    id: 1,
                    firstName: 'John',
                    lastName: 'Doe',
                },
            };

            mockPrismaService.visitor.findUnique.mockResolvedValue(mockVisitor);
            mockPrismaService.onetimeCode.create.mockResolvedValue(mockOnetimeCode);

            const result = await service.generateCode(visitorId, generateCodeDto, user);

            expect(result).toHaveProperty('qrCode');
            expect(result).toHaveProperty('qrData');
            expect(result.code).toBe('ABC12345');
            expect(mockPrismaService.onetimeCode.create).toHaveBeenCalled();
        });
    });

    describe('validateCode', () => {
        it('should validate a valid code', async () => {
            const code = 'ABC12345';
            const mockOnetimeCode = {
                id: 1,
                codeType: VisitorCodeType.ONETIME,
                code,
                startDate: new Date('2024-01-01T09:00:00Z'),
                endDate: new Date('2024-01-01T18:00:00Z'),
                visitor: {
                    id: 1,
                    firstName: 'John',
                    lastName: 'Doe',
                    middleName: null,
                    phone: '+998901234567',
                    workPlace: 'Test Company',
                },
            };

            mockPrismaService.onetimeCode.findFirst.mockResolvedValue(mockOnetimeCode);

            const result = await service.validateCode(code);

            expect(result).toEqual(mockOnetimeCode);
        });

        it('should throw NotFoundException for invalid code', async () => {
            const code = 'INVALID';
            mockPrismaService.onetimeCode.findFirst.mockResolvedValue(null);

            await expect(service.validateCode(code)).rejects.toThrow(NotFoundException);
        });
    });
});
