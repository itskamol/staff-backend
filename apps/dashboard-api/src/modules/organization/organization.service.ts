import { ConflictException, Injectable } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';
import { Organization, Prisma } from '@prisma/client';
import { DataScope } from '@app/shared/auth';
import { QueryDto } from '../../shared/dto/query.dto';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';

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
                scope
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
        return this.organizationRepository.findWithScope(scope);
    }

    async createOrganization(data: CreateOrganizationDto): Promise<Organization> {
        const input: Prisma.OrganizationCreateInput = { ...data };

        const exsists = await this.organizationRepository.findUnique({ shortName: data.shortName });

        if (exsists) throw new ConflictException('shortName already exists!');

        input.policies = {
            create: {
                title: 'Default Policy',
                description: 'Default policy created with organization',
                isDefault: true,
            },
        };

        input.employeePlans = {
            create: {
                isDefault: true,
                name: 'Default Plan',
                startTime: '09:00',
                extraTime: '00:10',
                weekdays: 'Monday',
                endTime: '18:00',
            },
        };

        const organization = await this.organizationRepository.create(input);

        return organization;
    }

    async updateOrganization(id: number, data: UpdateOrganizationDto, scope?: DataScope) {
        return this.organizationRepository.update(id, data, undefined, scope);
    }

    async deleteOrganization(id: number, scope?: DataScope) {
        return this.organizationRepository.delete(id, scope);
    }
}
