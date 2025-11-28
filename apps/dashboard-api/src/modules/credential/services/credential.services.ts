import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Credential } from '@prisma/client';
import { DataScope, UserContext } from '@app/shared/auth';
import { EmployeeService } from '../../employee/services/employee.service';
import {
    CredentialRepository,
    CredentialWithRelations,
} from '../repositories/credential.repository';
import {
    CreateCredentialDto,
    CredentialQueryDto,
    UpdateCredentialDto,
} from '../dto/credential.dto';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { EmployeeWithRelations } from '../../employee/repositories/employee.repository';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
        private readonly hikvisionAnprService: HikvisionAnprService
    ) {}

    async getAllCredentials(query: CredentialQueryDto, scope: DataScope, user: UserContext) {
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

    async getEmployeeCredentialCode(code: string) {
        return this.credentialRepository.findFirst({ code }, undefined, {
            employee: { select: { id: true } },
        });
    }

    async getCredentialById(
        id: number,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations> {
        const credential = await this.credentialRepository.findById(
            id,
            this.credentialRepository.getDefaultInclude(),
            scope
        );

        if (!credential) throw new NotFoundException(`Credential with ID ${id} not found.`);

        const employee = await this.employeeService.getEmployeeById(
            credential.employeeId,
            scope,
            user
        );
        if (!employee) throw new NotFoundException('Access to the associated employee is denied.');

        return credential;
    }

    async getCredentialsByEmployeeId(
        employeeId: number,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations[]> {
        const employee = await this.employeeService.getEmployeeById(employeeId, scope, user);
        if (!employee) throw new NotFoundException('Employee not found or access denied.');

        return this.credentialRepository.findByEmployeeId(employeeId, scope);
    }

    async createCredential(
        dto: CreateCredentialDto,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations> {
        const employee = await this.employeeService.getEmployeeById(dto.employeeId, scope, user);
        if (!employee)
            throw new NotFoundException(
                `Employee with ID ${dto.employeeId} not found or access denied.`
            );

        if (dto.type === 'PHOTO' && !employee.photo) {
            throw new BadRequestException('Employee photo is missing.');
        }

        if (dto.type === 'CAR' && dto.code) {
            const avtoNumber = await this.getEmployeeCredentialCode(dto.code);
            if (avtoNumber) {
                throw new BadRequestException('This avto number already exists!');
            }
        }

        const orgId = scope?.organizationId || dto?.organizationId;

        const data: Prisma.CredentialCreateInput = {
            code: dto.code,
            type: dto.type,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
            employee: { connect: { id: dto.employeeId } },
            organization: { connect: { id: orgId } },
        };

        return this.credentialRepository.create(
            data,
            this.credentialRepository.getDefaultInclude(),
            scope
        );
    }

    async updateCredential(
        id: number,
        dto: UpdateCredentialDto,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations> {
        const existingCredential = await this.getCredentialById(id, scope, user);
        const employee = await this.employeeService.getEmployeeById(
            existingCredential.employeeId,
            scope,
            user
        );

        if (dto.type === 'PHOTO' && !employee.photo) {
            throw new BadRequestException('Employee photo is missing.');
        }

        await this.deleteEditCreateFromDevice(employee, dto, id, 'Edit');

        const updateData: Prisma.CredentialUpdateInput = {
            code: dto.code,
            type: dto.type,
            additionalDetails: dto.additionalDetails,
            isActive: dto.isActive,
        };

        return this.credentialRepository.update(
            id,
            updateData,
            this.credentialRepository.getDefaultInclude(),
            scope
        );
    }

    private async deleteEditCreateFromDevice(
        employee: EmployeeWithRelations,
        dto?: UpdateCredentialDto,
        id?: number,
        type?: 'Delete' | 'Edit' | 'Create'
    ) {
        const oldCredential = employee.credentials.find(data => data.id === id);

        if (dto?.type === 'CAR' || oldCredential.type === 'CAR') {
            let devices = [];

            for (let gate of employee.gates) {
                const found = gate.devices.filter(device => device.type === 'CAR');
                devices.push(...found);
            }

            for (let device of devices) {
                let config: HikvisionConfig = {
                    host: device.ipAddress,
                    protocol: 'http',
                    port: 80,
                    password: device.password,
                    username: device.login,
                };

                switch (type) {
                    case 'Edit':
                        await this.hikvisionAnprService.editLicensePlate(
                            oldCredential.code,
                            dto.code,
                            '1',
                            config
                        );
                        break;

                    case 'Delete':
                        await this.hikvisionAnprService.deleteLicensePlate(
                            oldCredential.code,
                            config
                        );
                        break;

                    default:
                        console.warn('Unknown type:', type);
                        break;
                }
            }
        }
    }

    async deleteCredential(id: number, scope: DataScope, user: UserContext): Promise<Credential> {
        const existingCredential = await this.getCredentialById(id, scope, user);
        const employee = await this.employeeService.getEmployeeById(
            existingCredential.employeeId,
            scope,
            user
        );
        this.deleteEditCreateFromDevice(employee, undefined, id, 'Delete');
        return this.credentialRepository.deleteCredential(id, scope);
    }
}
