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
        scope?: DataScope
    ) {
        return this.organizationRepository.findMany(
            filters,
            { createdAt: 'desc' },
            undefined,
            pagination,
            scope
        );
    }

    async getOrganizationById(id: number, scope?: DataScope) {
        return this.organizationRepository.findById(id, undefined, scope);
    }

    async searchOrganizations(
        searchTerm: string,
        pagination: PaginationDto
    ): Promise<Organization[]> {
        return this.organizationRepository.findMany(
            {
                OR: [
                    { fullName: { contains: searchTerm, mode: 'insensitive' } },
                    { shortName: { contains: searchTerm, mode: 'insensitive' } },
                ],
            },
            { fullName: 'asc' },
            undefined,
            pagination
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
