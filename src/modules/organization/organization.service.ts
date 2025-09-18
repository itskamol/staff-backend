import { Injectable } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';
import { DataScope } from '@/shared/interfaces';
import { Organization, Prisma } from '@prisma/client';
import { CreateOrganizationDto, PaginationDto, UpdateOrganizationDto } from '@/shared/dto';

@Injectable()
export class OrganizationService {
    constructor(private readonly organizationRepository: OrganizationRepository) {}

    async getOrganizations(
        filters: Prisma.OrganizationWhereInput = {},
        pagination: PaginationDto,
        q?: string,
        scope?: DataScope
    ) {
        if (q) {
            filters.OR = [
                { fullName: { contains: q, mode: 'insensitive' } },
                { shortName: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.organizationRepository.findMany(
                filters,
                { createdAt: 'desc' },
                { _count: { select: { departments: true } } },
                pagination,
                scope
            ),
            this.organizationRepository.count(filters, scope),
        ]);

        return {
            data,
            total,
            page: pagination.page,
            limit: pagination.limit,
        };
    }

    async getOrganizationById(id: number, scope?: DataScope) {
        return this.organizationRepository.findById(id, { departments: true }, scope);
    }

    async createOrganization(data: CreateOrganizationDto): Promise<Organization> {
        return this.organizationRepository.create(data);
    }

    async updateOrganization(id: number, data: UpdateOrganizationDto, scope?: DataScope) {
        return this.organizationRepository.update(id, data, undefined, scope);
    }

    async deleteOrganization(id: number, scope?: DataScope) {
        return this.organizationRepository.delete(id, scope);
    }
}
