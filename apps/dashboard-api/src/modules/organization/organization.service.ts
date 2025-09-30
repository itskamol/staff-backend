import { Injectable } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';
import { Organization, Prisma } from '@prisma/client';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '../../shared/dto/query.dto';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../../shared/dto';

@Injectable()
export class OrganizationService {
    constructor(private readonly organizationRepository: OrganizationRepository) {}

    async getOrganizations(
        { search, isActive, sort, order, page, limit }: QueryDto,
        scope?: DataScope
    ) {
        const filters: Prisma.OrganizationWhereInput = {};
        if (search) {
            filters.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (typeof isActive === 'boolean') {
            filters.isActive = isActive;
        }

        const [data, total] = await Promise.all([
            this.organizationRepository.findMany(
                filters,
                { [sort]: order },
                {
                    _count: {
                        select: { departments: true, employees: true },
                    },
                },
                { page, limit },
                undefined,
                scope,
            ),
            this.organizationRepository.count(filters, scope),
        ]);

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async getOrganizationById(id: number, scope?: DataScope) {
        return this.organizationRepository.findById(id, { departments: true }, scope);
    }

    async getOrganizationsByScope(scope: DataScope) {
        return this.organizationRepository.findMany(
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            scope,
        );
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
