import { EmployeeWithRelations } from '../../employee/repositories/employee.repository';
import { EmployeeService } from '../../employee/services/employee.service';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';
import {
    CreateCredentialDto,
    CredentialQueryDto,
    UpdateCredentialDto,
} from '../dto/credential.dto';
import {
    CredentialRepository,
    CredentialWithRelations,
} from '../repositories/credential.repository';
import { ActionType, Prisma } from '@prisma/client';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataScope, UserContext } from '@app/shared/auth';

@Injectable()
export class CredentialService {
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
        private readonly hikvisionAnprService: HikvisionAnprService,
        private readonly hikvisionAccessService: HikvisionAccessService
    ) {}

    async getAllCredentials(query: CredentialQueryDto, scope: DataScope) {
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
            ...(search && {
                OR: [
                    { code: { contains: search, mode: 'insensitive' } },
                    { employee: { name: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        };

        const items = await this.credentialRepository.findManyWithPagination(
            where,
            { [sort]: order },
            this.credentialRepository.getDefaultInclude(),
            { page, limit },
            scope
        );

        return items;
    }

    async getCredentialById(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.credentialRepository.findById(
            id,
            this.credentialRepository.getDefaultInclude(),
            scope
        );

        if (!credential || credential.deletedAt)
            throw new NotFoundException(`Credential with ID ${id} not found.`);

        return credential;
    }

    async getCredentialByEmployeeId(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.credentialRepository.findByEmployeeId(id, scope);

        return credential;
    }

    async createCredential(
        dto: CreateCredentialDto,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations> {
        const employee = await this.getEmployee(dto.employeeId, scope, user);

        this.validatePhoto(dto.type, dto.additionalDetails);
        await this.validateUniqueCode(dto.type, dto.code);

        if (this.shouldDeactivate(dto.type, dto.isActive)) {
            await this.deactivateOld(employee.id, dto.type);
        }

        return this.credentialRepository.create(
            {
                code: dto.code,
                type: dto.type,
                additionalDetails: dto.additionalDetails,
                isActive: dto.isActive,
                employee: { connect: { id: employee.id } },
                organization: {
                    connect: { id: scope?.organizationId || dto.organizationId },
                },
            },
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
        const existing = await this.getCredentialById(id, scope, user);
        const employee = await this.getEmployee(existing.employeeId, scope, user);
        const additionalDetails = dto.additionalDetails ?? existing.additionalDetails;
        this.validatePhoto(dto.type ?? existing.type, additionalDetails);
        await this.validateUniqueCode(dto.type ?? existing.type, dto.code, id);

        await this.syncDevices(employee, existing, dto);

        if (dto.isActive === false) {
            await this.syncDevices(employee, existing, dto, 'Delete');
        }

        if (dto.isActive === true) {
            await this.syncDevices(employee, existing, dto, 'Create');
        }

        if (dto.isActive && this.shouldDeactivate(dto.type)) {
            await this.deactivateOld(employee.id, dto.type, id);
        }

        return this.credentialRepository.update(
            id,
            {
                code: dto.code,
                type: dto.type,
                additionalDetails: dto.additionalDetails,
                isActive: dto.isActive,
            },
            this.credentialRepository.getDefaultInclude(),
            scope
        );
    }

    async deleteCredential(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.getCredentialById(id, scope, user);
        const employee = await this.getEmployee(credential.employeeId, scope, user);

        await this.syncDevices(employee, credential, undefined, 'Delete');
        return this.credentialRepository.deleteCredential(id, scope);
    }

    private async getEmployee(id: number, scope: DataScope, user: UserContext) {
        const employee = await this.employeeService.getEmployeeById(id, scope, user);
        if (!employee) throw new NotFoundException('Employee not found or access denied.');
        return employee;
    }

    private validatePhoto(type: string, details?: string) {
        if (type === 'PHOTO' && !details) {
            throw new BadRequestException('Employee photo is missing.');
        }
    }

    private async validateUniqueCode(type: string, code?: string, excludeId?: number) {
        if (!code) return;
        if (!['CAR', 'PERSONAL_CODE'].includes(type)) return;

        const exists = await this.credentialRepository.findFirst(
            { code, ...(excludeId && { id: { not: excludeId } }) },
            undefined
        );

        if (exists) {
            throw new BadRequestException(`${type} already exists.`);
        }
    }

    private shouldDeactivate(type: string, isActive = true) {
        return isActive && ['PHOTO', 'PERSONAL_CODE'].includes(type);
    }

    private async deactivateOld(employeeId: number, type: ActionType, excludeId?: number) {
        await this.credentialRepository.updateMany(
            {
                employeeId,
                type,
                ...(excludeId && { id: { not: excludeId } }),
            },
            { isActive: false },
            {}
        );
    }

    private async syncDevices(
        employee: EmployeeWithRelations,
        oldCredential: CreateCredentialDto,
        dto?: UpdateCredentialDto,
        action: 'Create' | 'Edit' | 'Delete' = 'Edit'
    ) {
        const type = dto?.type ?? oldCredential.type;
        const code = dto?.code ?? oldCredential.code;
        const faceUrl = dto?.additionalDetails ?? oldCredential.additionalDetails;

        const devices = employee.gates.flatMap(g =>
            g.devices.filter(d => this.isDeviceCompatible(type, d.type))
        );

        for (const device of devices) {
            const config: HikvisionConfig = {
                host: device.ipAddress,
                protocol: 'http',
                port: 80,
                username: device.login,
                password: device.password,
            };

            try {
                await this.handleDeviceAction(type, action, employee, code, faceUrl, config);
            } catch (e) {
                console.error(`[${type}] device sync error:`, e.message);
            }
        }
    }

    private isDeviceCompatible(credType: string, deviceType: string) {
        const map = {
            CAR: ['CAR'],
            PHOTO: ['FACE', 'ACCESS_CONTROL'],
            PERSONAL_CODE: ['FACE', 'ACCESS_CONTROL'],
            CARD: ['FACE', 'ACCESS_CONTROL'],
        };
        return map[credType]?.includes(deviceType);
    }

    private async handleDeviceAction(
        type: string,
        action: string,
        employee: EmployeeWithRelations,
        code: string,
        faceUrl: string,
        config: HikvisionConfig,
        oldCredential?: CreateCredentialDto
    ) {
        switch (type) {
            case 'CAR':
                if (action === 'Delete')
                    return this.hikvisionAnprService.deleteLicensePlate(code, config);
                if (action === 'Create')
                    return this.hikvisionAnprService.addLicensePlate(code, '1', config);
                return this.hikvisionAnprService.editLicensePlate(code, code, '1', config);

            case 'PHOTO':
                if (action === 'Delete')
                    return this.hikvisionAccessService.deleteFaceFromUser(
                        String(employee.id),
                        config
                    );
                return this.hikvisionAccessService.addFaceToUserViaURL(
                    String(employee.id),
                    faceUrl,
                    config
                );

            case 'PERSONAL_CODE':
                return this.hikvisionAccessService.addPasswordToUser(
                    String(employee.id),
                    action === 'Delete' ? '' : code,
                    config
                );

            case 'CARD':
                if (action === 'Delete')
                    return this.hikvisionAccessService.deleteCard({
                        employeeNo: String(employee.id),
                        cardNo: code,
                        config,
                    });
                if (action === 'Create')
                    return this.hikvisionAccessService.addCardToUser({
                        employeeNo: String(employee.id),
                        cardNo: code,
                        config,
                    });
                return this.hikvisionAccessService.replaceCard(
                    oldCredential.code,
                    code,
                    String(employee.id),
                    config
                );
        }
    }
}
