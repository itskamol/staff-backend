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
        { search, isActive, sort, order, page, limit, isDeleted }: QueryDto,
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

        if (!isDeleted) {
            filters.deletedAt = null;
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

    async getOrganizationDefaultPlan(id: number) {
        return this.organizationRepository.findById(id, {
            employeePlans: {
                where: {
                    isDefault: true,
                },
            },
        });
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
                weekdays: 'Monday,Tuesday,Wednesday,Thursday,Friday',
                endTime: '18:00',
            },
        };

        input.reasons = {
            createMany: {
                data: [
                    {
                        value: 'Other',
                    },
                    {
                        value: 'Late or absent due to health issues or medical appointment.',
                    },
                    {
                        value: 'Delayed due to heavy traffic or road congestion.',
                    },
                ],
            },
        };

        const organization = await this.organizationRepository.create(input);

        return organization;
    }

    async updateOrganization(id: number, data: UpdateOrganizationDto, scope?: DataScope) {
        return this.organizationRepository.update(id, data, undefined, scope);
    }

    async deleteOrganization(id: number, scope?: DataScope) {
        return this.organizationRepository.softDelete(id, scope);
    }
}
