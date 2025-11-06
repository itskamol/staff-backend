import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Credential, ActionType, Prisma } from '@prisma/client';
import { DataScope, UserContext } from '@app/shared/auth';
import { EmployeeService } from '../../employee/services/employee.service';
import { CredentialRepository, CredentialWithRelations } from '../repositories/credential.repository';
import { CreateCredentialDto, CredentialQueryDto, UpdateCredentialDto } from '../dto/credential.dto';
import { PrismaService } from '@app/shared/database';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
        private readonly prisma: PrismaService,
    ) { }


    async getAllCredentials(
        query: CredentialQueryDto,
        scope: DataScope,
        user: UserContext,
    ) {
        const {
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            search,
            type,
            employeeId,
            departmentId,
            organizationId,
        } = query;

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

        const [items, total] = await this.prisma.$transaction([
            this.prisma.credential.findMany({
                where,
                include: this.getDefaultInclude(),
                orderBy: { [sortBy]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.credential.count({ where }),
        ]);

        return {
            items,
            total,
            page,
            limit,
        };
    }

    private getDefaultInclude(): Prisma.CredentialInclude {
        return {
            employee: {
                select: {
                    id: true,
                    name: true,
                    departmentId: true,
                    organizationId: true,
                },
            },
        };
    }


    // async getEmployeePhotoCredential(employeeId:number){
    //   return this.credentialRepository.getCredentialsByEmployeeId(employeeId, )
    // }

    async getCredentialById(
        id: number,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations> {
        const credential = await this.credentialRepository.findById(id, this.credentialRepository.getDefaultInclude());

        if (!credential) {
            throw new NotFoundException(`Credential with ID ${id} not found.`);
        }

        const employeeId = credential.employeeId;
        const employee = await this.employeeService.getEmployeeById(employeeId, scope, user);

        if (!employee) {
            throw new NotFoundException('Credential found, but access to the associated employee is denied.');
        }

        return credential;
    }


    async getCredentialsByEmployeeId(
        employeeId: number,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations[]> {
        const employee = await this.employeeService.getEmployeeById(employeeId, scope, user);

        if (!employee) {
            throw new NotFoundException('Employee not found or access denied.');
        }

        return this.credentialRepository.findByEmployeeId(employeeId);
    }


    async createCredential(
        dto: CreateCredentialDto,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations> {

        const organizationId = dto.organizationId ? dto.organizationId : scope.organizationId

        const employee = await this.employeeService.getEmployeeById(dto.employeeId, scope, user);

        if (!employee) {
            throw new NotFoundException(`Employee with ID ${dto.employeeId} not found or access denied.`);
        }

        if (dto.type === ActionType.PHOTO && !employee.photo) {
            throw new BadRequestException('Employee photo is missing. Please upload a photo first.');
        }


        const data: Prisma.CredentialCreateInput = {
            code: dto.code,
            type: dto.type,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
            employee: { connect: { id: dto.employeeId } },
            organization: { connect: { id: organizationId } }
        };

        return this.credentialRepository.create(data, this.credentialRepository.getDefaultInclude());
    }

    async updateCredential(
        id: number,
        dto: UpdateCredentialDto,
        scope: DataScope,
        user: UserContext,
    ): Promise<CredentialWithRelations> {
        const existingCredential = await this.getCredentialById(id, scope, user);
        const employee = await this.employeeService.getEmployeeById(existingCredential.employeeId, scope, user);

        if (!existingCredential) {
            throw new NotFoundException(`Credential with ID ${id} not found.`);
        }

        if (dto.type === ActionType.PHOTO && !employee.photo) {
            throw new BadRequestException('Employee photo is missing. Please upload a photo first.');
        }

        const updateData: Prisma.CredentialUpdateInput = {
            code: dto.code,
            type: dto.type,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
        };

        return this.credentialRepository.update(id, updateData, this.credentialRepository.getDefaultInclude());
    }


    async deleteCredential(
        id: number,
        scope: DataScope,
        user: UserContext,
    ): Promise<Credential> {
        const existingCredential = await this.getCredentialById(id, scope, user);
        if (!existingCredential) {
            throw new NotFoundException(`Credential with ID ${id} not found.`);
        }

        return this.credentialRepository.deleteCredential(existingCredential.id);
    }
}
