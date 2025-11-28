import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Reasons } from '@prisma/client';
import { DataScope, UserContext } from '@app/shared/auth';
import { ReasonRepository } from '../repositories/reason.repository';
import { CreateReasonDto, UpdateReasonDto, ReasonQueryDto } from '../dto/reason.dto';

@Injectable()
export class ReasonService {
    constructor(private readonly reasonRepository: ReasonRepository) {}

    async getAllReasons(query: ReasonQueryDto, scope: DataScope, user: UserContext) {
        const { page = 1, limit = 10, sort = 'key', order = 'asc', search, organizationId } = query;

        const where: Prisma.ReasonsWhereInput = {
            ...(organizationId && { organizationId }),
        };

        if (search) {
            where.OR = [
                { key: { contains: search, mode: 'insensitive' } },
                { value: { contains: search, mode: 'insensitive' } },
            ];
        }

        const items = await this.reasonRepository.findMany(
            where,
            { [sort]: order },
            undefined, // include kerak bo'lmasa undefined
            { page, limit },
            undefined,
            scope
        );

        const total = await this.reasonRepository.count(where, scope);

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async getReasonById(id: number, scope: DataScope, user: UserContext): Promise<Reasons> {
        const reason = await this.reasonRepository.findById(id, undefined, scope);
        if (!reason) {
            throw new NotFoundException(`Reason with ID ${id} not found.`);
        }
        return reason;
    }

    async createReason(
        dto: CreateReasonDto,
        scope: DataScope,
        user: UserContext
    ): Promise<Reasons> {
        const orgId = scope?.organizationId || dto.organizationId;

        if (!orgId) {
            // Agar scope da ham, dto da ham organizationId bo'lmasa
            // (Admin bo'lmagan userlar uchun scope da har doim bo'ladi)
            throw new BadRequestException('Organization ID is required');
        }

        // Key takrorlanmasligini tekshirish (organization ichida)
        if (orgId) {
            const existing = await this.reasonRepository.findFirst({
                key: dto.key,
                organizationId: orgId,
            });
            if (existing) {
                throw new BadRequestException(
                    `Reason with key "${dto.key}" already exists in this organization.`
                );
            }
        }

        const data: Prisma.ReasonsCreateInput = {
            key: dto.key,
            value: dto.value,
            organization: { connect: { id: orgId } },
        };

        return this.reasonRepository.create(data, undefined, scope);
    }

    async updateReason(
        id: number,
        dto: UpdateReasonDto,
        scope: DataScope,
        user: UserContext
    ): Promise<Reasons> {
        await this.getReasonById(id, scope, user); // Check exists and access

        const updateData: Prisma.ReasonsUpdateInput = {
            key: dto.key,
            value: dto.value,
        };

        return this.reasonRepository.update(id, updateData, undefined, scope);
    }

    async deleteReason(id: number, scope: DataScope, user: UserContext): Promise<Reasons> {
        await this.getReasonById(id, scope, user); // Check exists and access
        return this.reasonRepository.delete(id, scope);
    }
}
