// ...existing code...
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRepository } from './attendance.repository';
import { CreateAttendanceDto, AttendanceQueryDto, UpdateAttendanceDto } from './dto/attendance.dto';
import { PrismaService } from '@app/shared/database';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class AttendanceService {
    constructor(
        private readonly repo: AttendanceRepository,
        private readonly prisma: PrismaService,
    ) { }

    async create(dto: CreateAttendanceDto) {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const existing = await this.repo.findMany({
                where: {
                    employeeId: dto.employeeId,
                    startTime: { gte: todayStart, lte: todayEnd },
                },
            });

            if (existing.length > 0) {
                return existing
            }

            // mavjud bo‘lmasa, yaratish
            return this.repo.create({
                ...dto,
                employeeId: dto.employeeId,
                organizationId: dto.organizationId,
            });
        } catch (error) {
            throw new BadRequestException({ message: error.message });
        }
    }

    async findAll(query: AttendanceQueryDto) {
        const where: any = {};

        if (query.employeeId !== undefined) where.employeeId = query.employeeId;
        if (query.organizationId !== undefined) where.organizationId = query.organizationId;
        if (query.arrivalStatus) where.arrivalStatus = query.arrivalStatus;

        if (query.from || query.to) {
            where.startTime = {};
            if (query.from) where.startTime.gte = new Date(query.from);
            if (query.to) where.startTime.lte = new Date(query.to);
        }

        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;

        const data = await this.repo.findMany({
            skip,
            take: limit,
            where,
            include: {
                employee: {
                    select: {
                        id: true, name: true, photo: true, department: { 
                            select: {
                                id: true,
                                fullName: true,
                            },
                        },
                    },
                },
            },
            orderBy: { startTime: 'desc' },
        });

        const total = await this.repo.count(where);

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async findById(id: number) {
        const record = await this.repo.findById(id);
        if (!record) throw new NotFoundException('Attendance record not found');
        return record;
    }

    async update(id: number, dto: UpdateAttendanceDto) {
        await this.findById(id);
        return this.repo.update(id, dto);
    }

    async delete(id: number) {
        await this.findById(id);
        return this.repo.delete(id);
    }
}