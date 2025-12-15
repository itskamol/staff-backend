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
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
        private readonly hikvisionAnprService: HikvisionAnprService,
        private readonly hikvisionAccessService: HikvisionAccessService
    ) {}

    async getAllCredentials(query: CredentialQueryDto, scope: DataScope, user: UserContext) {
        const {
            page = 1,
            limit = 10,
            sort = 'createdAt',
            order = 'desc',
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
            { [sort]: order },
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

        if (!credential || credential.deletedAt !== null)
            throw new NotFoundException(`Credential with ID ${id} not found.`);

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

        if (dto.type === 'PHOTO' && !dto.additionalDetails) {
            throw new BadRequestException('Employee photo is missing.');
        }

        if (dto.type === 'CAR' && dto.code) {
            const avtoNumber = await this.getEmployeeCredentialCode(dto.code);
            if (avtoNumber) {
                throw new BadRequestException('This avto number already exists!');
            }
        }

        if (dto.type === 'PERSONAL_CODE' && dto.code) {
            const personalCode = await this.getEmployeeCredentialCode(dto.code);
            if (personalCode) {
                throw new BadRequestException('This personal code already exists!');
            }
        }

        if (dto.type === 'PHOTO' && dto.isActive) {
            await this.credentialRepository.updateMany(
                { employeeId: dto.employeeId, type: 'PHOTO' },
                { isActive: false },
                {}
            );
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
        if (!existingCredential) {
            throw new BadRequestException('Credential not found.');
        }
        const employee = await this.employeeService.getEmployeeById(
            existingCredential.employeeId,
            scope,
            user
        );

        if (dto.type === 'PHOTO' && !employee.photo) {
            throw new BadRequestException('Employee photo is missing.');
        }

        // Qurilmalarda yangilash
        await this.deleteEditCreateFromDevice(employee, dto, id, 'Edit');

        if (dto.isActive === false) {
            await this.deleteEditCreateFromDevice(employee, dto, id, 'Delete');
        }

        if (dto.isActive === true) {
            await this.deleteEditCreateFromDevice(employee, dto, id, 'Create');
        }

        if ((existingCredential.type === 'PHOTO' || dto.type === 'PHOTO') && dto.isActive) {
            const employeeId = existingCredential.employeeId || dto.employeeId;
            await this.credentialRepository.updateMany(
                { employeeId: employeeId, type: 'PHOTO', id: { not: id } },
                { isActive: false },
                {}
            );
        }

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

    async deleteCredential(id: number, scope: DataScope, user: UserContext): Promise<Credential> {
        const existingCredential = await this.getCredentialById(id, scope, user);
        if (!existingCredential) {
            throw new BadRequestException('Credential not found.');
        }
        const employee = await this.employeeService.getEmployeeById(
            existingCredential.employeeId,
            scope,
            user
        );

        await this.deleteEditCreateFromDevice(employee, undefined, id, 'Delete');

        return this.credentialRepository.deleteCredential(id, scope);
    }

    private async deleteEditCreateFromDevice(
        employee: EmployeeWithRelations,
        dto?: UpdateCredentialDto,
        id?: number,
        type?: 'Delete' | 'Edit' | 'Create'
    ) {
        const oldCredential = id ? employee.credentials.find(data => data.id === id) : null;

        const credType = dto?.type || oldCredential?.type;

        if (credType === 'CAR') {
            let devices = [];
            for (let gate of employee.gates) {
                const found = gate.devices.filter(d => d.type === 'CAR');
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

                try {
                    switch (type) {
                        case 'Edit':
                            if (oldCredential && dto?.code) {
                                await this.hikvisionAnprService.editLicensePlate(
                                    oldCredential.code,
                                    dto.code,
                                    '1',
                                    config
                                );
                            }
                            break;

                        case 'Delete':
                            if (oldCredential?.code) {
                                await this.hikvisionAnprService.deleteLicensePlate(
                                    oldCredential.code,
                                    config
                                );
                            }
                            break;

                        case 'Create':
                            if (dto?.code) {
                                await this.hikvisionAnprService.addLicensePlate(
                                    dto.code,
                                    '1',
                                    config
                                );
                            }
                            break;
                    }
                } catch (err) {
                    console.error(`ANPR Device sync error (${type}):`, err.message);
                }
            }
        }

        if (credType === 'PHOTO') {
            let devices = [];
            for (let gate of employee.gates) {
                const found = gate.devices.filter(
                    d => d.type === 'FACE' || d.type === 'ACCESS_CONTROL'
                );
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

                try {
                    switch (type) {
                        case 'Delete':
                            await this.hikvisionAccessService.deleteFaceFromUser(
                                String(employee.id),
                                config
                            );
                            break;

                        case 'Edit':
                            const faceUrl = dto?.additionalDetails
                                ? dto.additionalDetails
                                : oldCredential?.additionalDetails;

                            await this.hikvisionAccessService.addFaceToUserViaURL(
                                employee.id.toString(),
                                faceUrl,
                                config
                            );
                            break;

                        case 'Create':
                            const faceUrlCreate = dto?.additionalDetails
                                ? dto.additionalDetails
                                : oldCredential?.additionalDetails;

                            await this.hikvisionAccessService.addFaceToUserViaURL(
                                employee.id.toString(),
                                faceUrlCreate,
                                config
                            );
                            break;
                    }
                } catch (err) {
                    console.error(`Access Device sync error (${type}):`, err.message);
                }
            }
        }

        if (credType === 'PERSONAL_CODE') {
            let devices = [];
            for (let gate of employee.gates) {
                const found = gate.devices.filter(
                    d => d.type === 'FACE' || d.type === 'ACCESS_CONTROL'
                );
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

                try {
                    switch (type) {
                        case 'Delete':
                            await this.hikvisionAccessService.addPasswordToUser(
                                String(employee.id),
                                '',
                                config
                            );
                            break;

                        case 'Edit':
                            const personalCode = dto?.code ? dto.code : oldCredential?.code;

                            await this.hikvisionAccessService.addPasswordToUser(
                                employee.id.toString(),
                                personalCode,
                                config
                            );
                            break;

                        case 'Create':
                            const personalCodeCreate = dto?.code ? dto.code : oldCredential?.code;

                            await this.hikvisionAccessService.addPasswordToUser(
                                employee.id.toString(),
                                personalCodeCreate,
                                config
                            );
                            break;
                    }
                } catch (err) {
                    console.error(`Access Device sync error (${type}):`, err.message);
                }
            }
        }

        if (credType === 'CARD') {
            let devices = [];
            for (let gate of employee.gates) {
                const found = gate.devices.filter(
                    d => d.type === 'ACCESS_CONTROL' || d.type === 'FACE'
                );
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

                try {
                    switch (type) {
                        case 'Delete':
                            await this.hikvisionAccessService.deleteCard({
                                employeeNo: String(employee.id),
                                cardNo: oldCredential.code,
                                config,
                            });
                            break;

                        case 'Edit':
                            const personalCode = dto?.code ? dto.code : oldCredential?.code;

                            await this.hikvisionAccessService.replaceCard(
                                oldCredential.code,
                                personalCode,
                                employee.id.toString(),
                                config
                            );
                            break;

                        case 'Create':
                            const personalCodeCreate = dto?.code ? dto.code : oldCredential?.code;

                            await this.hikvisionAccessService.addCardToUser({
                                employeeNo: employee.id.toString(),
                                cardNo: personalCodeCreate,
                                config,
                            });
                            break;
                    }
                } catch (err) {
                    console.error(`Access Device sync error (${type}):`, err.message);
                }
            }
        }
    }
}
