import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, Reasons } from '@prisma/client';
import { DataScope, UserContext } from '@app/shared/auth';
import { ReasonRepository } from '../repositories/reason.repository';
import { CreateReasonDto, UpdateReasonDto, ReasonQueryDto } from '../dto/reason.dto';

@Injectable()
export class ReasonService {
    constructor(private readonly reasonRepository: ReasonRepository) {}

    async getAllReasons(query: ReasonQueryDto, scope: DataScope, user: UserContext) {
        const { page = 1, limit = 10, sort = 'id', order = 'desc', search, organizationId } = query;

        const where: Prisma.ReasonsWhereInput = {
            ...(organizationId && { organizationId }),
        };

        if (search) {
            where.OR = [
                { uz: { contains: search, mode: 'insensitive' } },
                { eng: { contains: search, mode: 'insensitive' } },
                { ru: { contains: search, mode: 'insensitive' } },
            ];
        }

        const items = await this.reasonRepository.findMany(
            where,
            { [sort]: order },
            undefined,
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
            throw new BadRequestException('Organization ID is required');
        }

        const data: Prisma.ReasonsCreateInput = {
            uz: dto.uz,
            eng: dto.eng,
            ru: dto.ru,
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
        await this.getReasonById(id, scope, user);

        const updateData: Prisma.ReasonsUpdateInput = {
            uz: dto.uz,
            eng: dto.eng,
            ru: dto.ru,
        };

        return this.reasonRepository.update(id, updateData, undefined, scope);
    }

    async deleteReason(id: number, scope: DataScope, user: UserContext): Promise<Reasons> {
        await this.getReasonById(id, scope, user);
        return this.reasonRepository.softDelete(id, scope);
    }
}
