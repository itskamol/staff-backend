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
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { JOB } from 'apps/dashboard-api/src/shared/constants';

@Injectable()
export class CredentialService {
    private readonly CAR = ActionType.CAR;
    private readonly CARD = ActionType.CARD;
    private readonly PHOTO = ActionType.PHOTO;
    private readonly QR = ActionType.QR;
    private readonly PERSONAL_CODE = ActionType.PERSONAL_CODE;
    constructor(
        private readonly credentialRepository: CredentialRepository,
        private readonly employeeService: EmployeeService,
        @InjectQueue(JOB.DEVICE.NAME) private readonly deviceQueue: Queue,
        private readonly logger: LoggerService
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
            ...(search && {
                OR: [
                    { code: { contains: search, mode: 'insensitive' } },
                    { employee: { name: { contains: search, mode: 'insensitive' } } },
                ],
            }),
        };

        if (scope.departmentIds.length) {
            where.employee = { departmentId: { in: scope.departmentIds } };
        }

        const items = await this.credentialRepository.findManyWithPagination(
            where,
            { [sort]: order },
            this.credentialRepository.getDefaultInclude(),
            { page, limit },
            { organizationId: scope.organizationId }
        );

        this.logger.log(`Fetched credentials list for User ID ${user.sub}`, 'CredentialService');

        return items;
    }

    async getCredentialById(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.credentialRepository.findById(
            id,
            this.credentialRepository.getDefaultInclude(),
            { organizationId: scope.organizationId }
        );

        if (!credential || credential.deletedAt)
            throw new NotFoundException(`Credential with ID ${id} not found.`);

        this.logger.log(`Fetched credential ID ${id} for User ID ${user.sub}`, 'CredentialService');

        return credential;
    }

    async getCredentialByEmployeeId(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.credentialRepository.findByEmployeeId(id, {
            organizationId: scope.organizationId,
        });

        return credential;
    }

    async createCredential(
        dto: CreateCredentialDto,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations> {
        const employee = await this.getEmployee(dto.employeeId);
        this.validatePhoto(dto.type, dto.additionalDetails);
        await this.validateUniqueCode(dto.type, dto.code);

        if (this.shouldDeactivate(dto.type, dto.isActive)) {
            await this.deactivateOld(employee.id, dto.type);
        }
        const credential = await this.credentialRepository.create(
            {
                code: dto.code,
                type: dto.type,
                additionalDetails: dto.additionalDetails,
                isActive: dto.isActive,
                employee: { connect: { id: employee.id } },
                organization: { connect: { id: scope?.organizationId || dto.organizationId } },
            },
            this.credentialRepository.getDefaultInclude()
        );

        this.logger.log(
            `Credential created: ID ${credential.id} for Employee ID ${employee.id} by User ID ${user.sub}`,
            'CredentialService'
        );

        return credential;
    }

    async updateCredential(
        id: number,
        dto: UpdateCredentialDto,
        scope: DataScope,
        user: UserContext
    ): Promise<CredentialWithRelations> {
        const existing = await this.getCredentialById(id, scope, user);

        // Ma'lumot haqiqatda o'zgarganini tekshirish (Smart Sync flag uchun)
        const isDataChanged =
            (dto.code !== undefined && dto.code !== existing.code) ||
            (dto.additionalDetails !== undefined &&
                dto.additionalDetails !== existing.additionalDetails);

        const updated = await this.credentialRepository.update(
            id,
            dto,
            this.credentialRepository.getDefaultInclude()
        );

        // Mantiqiy holatlar bo'yicha job yuborish
        if (existing.isActive && updated.isActive === false) {
            // 1. O'chirildi yoki bloklandi
            await this.triggerDeviceSync(updated.employeeId, updated.id, 'Delete');
        } else if (updated.isActive && existing.isActive === false) {
            // 2. Qayta yoqildi
            await this.triggerDeviceSync(updated.employeeId, updated.id, 'Create');
        } else if (updated.isActive && isDataChanged) {
            // 3. Faol holatda ma'lumot o'zgardi (Edit)
            await this.triggerDeviceSync(updated.employeeId, updated.id, 'Edit', existing.code);
        }

        // Foto/Parol qoidasi
        if (dto.isActive && this.shouldDeactivate(updated.type)) {
            await this.deactivateOld(updated.employeeId, updated.type, id);
        }

        this.logger.log(
            `Credential updated: ID ${updated.id} for Employee ID ${updated.employeeId} by User ID ${user.sub}`,
            'CredentialService'
        );

        return updated;
    }

    async deleteCredential(id: number, scope: DataScope, user: UserContext) {
        const credential = await this.getCredentialById(id, scope, user);

        // Avval qurilmalardan o'chirishni buyuramiz
        await this.triggerDeviceSync(credential.employeeId, credential.id, 'Delete');

        const deleted = await this.credentialRepository.deleteCredential(id, {
            organizationId: scope.organizationId,
        });

        this.logger.log(
            `Credential deleted: ID ${deleted.id} for Employee ID ${deleted.employeeId} by User ID ${user.sub}`,
            'CredentialService'
        );

        return deleted;
    }

    private async triggerDeviceSync(
        employeeId: number,
        credentialId: number,
        action: 'Create' | 'Edit' | 'Delete',
        oldCode?: string
    ) {
        // Xodim qaysi darvozalarga biriktirilganini aniqlaymiz
        const employee = await this.getEmployee(employeeId);

        if (!employee || !employee.gates.length) return;

        for (const gate of employee.gates) {
            if (action === 'Delete') {
                // Granular o'chirish jobi
                await this.deviceQueue.add(JOB.DEVICE.REMOVE_SPECIFIC_CREDENTIALS, {
                    gateId: gate.id,
                    employeeId: employee.id,
                    credentialIds: [credentialId],
                });
            } else {
                // Qo'shish yoki Yangilash jobi
                await this.deviceQueue.add(JOB.DEVICE.SYNC_CREDENTIALS_TO_DEVICES, {
                    gateId: gate.id,
                    employeeId: employee.id,
                    credentialIds: [credentialId],
                    oldCode: oldCode,
                    isUpdate: action === 'Edit',
                });
            }
        }
    }

    private async getEmployee(id: number) {
        const employee = await this.employeeService.getEmployeeById(id);
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
}
