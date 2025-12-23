import { EmployeeService } from '../../employee/services/employee.service';
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
import { LoggerService } from 'apps/dashboard-api/src/core/logger';
import { InjectQueue } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';
import { Queue } from 'bullmq';

@Injectable()
export class CredentialService {
    private readonly CAR = ActionType.CAR;
    private readonly CARD = ActionType.CARD;
    private readonly PHOTO = ActionType.PHOTO;
    private readonly QR = ActionType.QR;
    private readonly PERSONAL_CODE = ActionType.PERSONAL_CODE;
    constructor(
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue,
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
        private readonly logger: LoggerService
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

        const finalType = dto.type ?? existing.type;
        const finalCode = dto.code ?? existing.code;
        const finalDetails = dto.additionalDetails ?? existing.additionalDetails;

        this.validatePhoto(finalType, finalDetails);
        await this.validateUniqueCode(finalCode ? finalType : null, finalCode, id);

        if (dto.isActive === false && existing.isActive === true) {
            await this.syncDevices(employee.id, existing.id, 'Delete');
        } else if (dto.isActive === true && existing.isActive === false) {
            await this.syncDevices(employee.id, existing.id, 'Create');
        } else if (existing.isActive) {
            const isCodeChanged = dto.code && dto.code !== existing.code;
            const isPhotoChanged =
                dto.additionalDetails && dto.additionalDetails !== existing.additionalDetails;

            if (isCodeChanged || isPhotoChanged) {
                await this.syncDevices(employee.id, existing.id, 'Edit', existing.code);
            }
        }

        if (dto.isActive && this.shouldDeactivate(finalType)) {
            await this.deactivateOld(employee.id, finalType, id);
        }

        return this.credentialRepository.update(
            id,
            dto,
            this.credentialRepository.getDefaultInclude(),
            scope
        );
    }

    async deleteCredential(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.getCredentialById(id, scope, user);
        const employee = await this.getEmployee(credential.employeeId, scope, user);

        await this.syncDevices(employee.id, credential.id, 'Delete');
        return this.credentialRepository.deleteCredential(id, scope);
    }

    private async getEmployee(id: number, scope: DataScope, user: UserContext) {
        const employee = await this.employeeService.getEmployeeById(id, scope, user);
        if (!employee) throw new NotFoundException('Employee not found or access denied.');
        return employee;
    }

    private validatePhoto(type: string, details?: string) {
        if (type === this.PHOTO && !details) {
            throw new BadRequestException('Employee photo is missing.');
        }
    }

    private async validateUniqueCode(type: ActionType, code?: string, excludeId?: number) {
        if (!code) return;
        if (!([this.CAR, this.PERSONAL_CODE, this.QR, this.CARD] as ActionType[]).includes(type)) {
            return;
        }

        const exists = await this.credentialRepository.findFirst(
            { code, ...(excludeId && { id: { not: excludeId } }) },
            undefined
        );

        if (exists) {
            throw new BadRequestException(`${type} already exists.`);
        }
    }

    private shouldDeactivate(type: ActionType, isActive = true) {
        return isActive && ([this.PHOTO, this.PERSONAL_CODE] as ActionType[]).includes(type);
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
        employeeId: number,
        credentialId: number,
        action: 'Create' | 'Edit' | 'Delete' = 'Edit',
        oldCode?: string
    ) {
        await this.deviceQueue.add(JOB.DEVICE.SYNC_SINGLE_CREDENTIAL, {
            employeeId,
            credentialId,
            action,
            oldCode,
        });
    }
}
