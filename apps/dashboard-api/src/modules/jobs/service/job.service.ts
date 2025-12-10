import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Job, Prisma } from '@prisma/client';
import { DataScope, UserContext } from '@app/shared/auth';
import { CreateJobDto, UpdateJobDto, JobQueryDto } from '../dto/job.dto';
import { JobRepository } from '../repositories/job.repository';

@Injectable()
export class JobService {
    constructor(private readonly jobRepository: JobRepository) {}

    async getAllJobs(query: JobQueryDto, scope: DataScope, user: UserContext) {
        const { page = 1, limit = 10, sort = 'id', order = 'desc', search, organizationId } = query;

        const where: Prisma.JobWhereInput = {
            ...(organizationId && { organizationId }),
        };

        if (search) {
            where.OR = [
                { uz: { contains: search, mode: 'insensitive' } },
                { eng: { contains: search, mode: 'insensitive' } },
                { ru: { contains: search, mode: 'insensitive' } },
            ];
        }

        const items = await this.jobRepository.findMany(
            where,
            { [sort]: order },
            undefined,
            { page, limit },
            undefined,
            scope
        );

        const total = await this.jobRepository.count(where, scope);

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async getJobById(id: number, scope: DataScope, user: UserContext): Promise<Job> {
        const Job = await this.jobRepository.findById(id, undefined, scope);
        if (!Job) {
            throw new NotFoundException(`Job with ID ${id} not found.`);
        }
        return Job;
    }

    async createJob(dto: CreateJobDto, scope: DataScope, user: UserContext): Promise<Job> {
        const orgId = scope?.organizationId || dto.organizationId;

        if (!orgId) {
            throw new BadRequestException('Organization ID is required');
        }

        const data: Prisma.JobCreateInput = {
            uz: dto.uz,
            eng: dto.eng,
            ru: dto.ru,
            organization: { connect: { id: orgId } },
        };

        return this.jobRepository.create(data, undefined, scope);
    }

    async updateJob(
        id: number,
        dto: UpdateJobDto,
        scope: DataScope,
        user: UserContext
    ): Promise<Job> {
        await this.getJobById(id, scope, user);

        const updateData: Prisma.JobUpdateInput = {
            uz: dto.uz,
            eng: dto.eng,
            ru: dto.ru,
        };

        return this.jobRepository.update(id, updateData, undefined, scope);
    }

    async deleteJob(id: number, scope: DataScope, user: UserContext): Promise<Job> {
        await this.getJobById(id, scope, user);
        return this.jobRepository.softDelete(id, scope);
    }
}
