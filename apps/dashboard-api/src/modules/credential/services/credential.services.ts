import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Credential } from '@prisma/client';
import { DataScope, UserContext } from '@app/shared/auth';
import { EmployeeService } from '../../employee/services/employee.service';
import { CredentialRepository, CredentialWithRelations } from '../repositories/credential.repository';
import { CreateCredentialDto, CredentialQueryDto, UpdateCredentialDto } from '../dto/credential.dto';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
    ) {}

    async getAllCredentials(
        query: CredentialQueryDto,
        scope: DataScope,
        user: UserContext,
    ) {
        const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search, type, employeeId, departmentId, organizationId } = query;

        const where: Prisma.CredentialWhereInput = {
            ...(type && { type }),
            ...(employeeId && { employeeId }),
            ...(departmentId && { employee: { departmentId } }),
            ...(organizationId && { employee: { organizationId } }),
        };

        if (search) {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { employee: { name: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const items = await this.credentialRepository.findMany(
            where,
            { [sortBy]: sortOrder },
            this.credentialRepository.getDefaultInclude(),
            { page, limit },
            undefined,
            scope
        );

        const total = await this.credentialRepository.count(where, scope);

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async getCredentialById(
        id: number,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations> {
        const credential = await this.credentialRepository.findById(id, this.credentialRepository.getDefaultInclude(), scope);

        if (!credential) throw new NotFoundException(`Credential with ID ${id} not found.`);

        const employee = await this.employeeService.getEmployeeById(credential.employeeId, scope, user);
        if (!employee) throw new NotFoundException('Access to the associated employee is denied.');

        return credential;
    }

    async getCredentialsByEmployeeId(
        employeeId: number,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations[]> {
        const employee = await this.employeeService.getEmployeeById(employeeId, scope, user);
        if (!employee) throw new NotFoundException('Employee not found or access denied.');

        return this.credentialRepository.findByEmployeeId(employeeId, scope);
    }

    async createCredential(
        dto: CreateCredentialDto,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations> {
        const employee = await this.employeeService.getEmployeeById(dto.employeeId, scope, user);
        if (!employee) throw new NotFoundException(`Employee with ID ${dto.employeeId} not found or access denied.`);

        if (dto.type === 'PHOTO' && !employee.photo) {
            throw new BadRequestException('Employee photo is missing.');
        }

        const orgId = scope?.organizationId || dto?.organizationId

        const data: Prisma.CredentialCreateInput = {
            code: dto.code,
            type: dto.type,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
            employee: { connect: { id: dto.employeeId } },
            organization: { connect: { id: orgId } },
        };

        return this.credentialRepository.create(data, this.credentialRepository.getDefaultInclude(), scope);
    }

    async updateCredential(
        id: number,
        dto: UpdateCredentialDto,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations> {
        const existingCredential = await this.getCredentialById(id, scope, user);
        const employee = await this.employeeService.getEmployeeById(existingCredential.employeeId, scope, user);

        if (dto.type === 'PHOTO' && !employee.photo) {
            throw new BadRequestException('Employee photo is missing.');
        }

        const updateData: Prisma.CredentialUpdateInput = {
            code: dto.code,
            type: dto.type,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
        };

        return this.credentialRepository.update(id, updateData, this.credentialRepository.getDefaultInclude(), scope);
    }

    async deleteCredential(
        id: number,
        scope: DataScope,
        user: UserContext,
    ): Promise<Credential> {
        await this.getCredentialById(id, scope, user);
        return this.credentialRepository.deleteCredential(id, scope);
    }
}
