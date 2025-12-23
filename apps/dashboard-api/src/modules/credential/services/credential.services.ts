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
import { EmployeeWithRelations } from '../../employee/repositories/employee.repository';
import { HikvisionConfig } from '../../hikvision/dto/create-hikvision-user.dto';
import { HikvisionAnprService } from '../../hikvision/services/hikvision.anpr.service';
import { HikvisionAccessService } from '../../hikvision/services/hikvision.access.service';

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
        private readonly hikvisionAnprService: HikvisionAnprService,
        private readonly hikvisionAccessService: HikvisionAccessService,
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

        // Validatsiyalar
        this.validatePhoto(finalType, finalDetails);
        await this.validateUniqueCode(finalCode ? finalType : null, finalCode, id);

        // Sinxronizatsiya logikasi
        if (dto.isActive === false && existing.isActive === true) {
            // Bloklandi -> Qurilmadan o'chiramiz
            await this.syncDevices(employee, existing, dto, 'Delete');
        } else if (dto.isActive === true && existing.isActive === false) {
            // Faollashdi -> Qurilmaga yuboramiz
            await this.syncDevices(employee, existing, dto, 'Create');
        } else if (existing.isActive) {
            // Shunchaki ma'lumot o'zgardi (Masalan, moshina raqami o'zgardi)
            await this.syncDevices(employee, existing, dto, 'Edit');
        }

        // "Faqat bitta faol foto/parol" qoidasi
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

        await this.syncDevices(employee, credential, undefined, 'Delete');
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
        employee: EmployeeWithRelations,
        oldCredential: CreateCredentialDto, // Faqat kerakli maydonlar
        dto?: UpdateCredentialDto,
        action: 'Create' | 'Edit' | 'Delete' = 'Edit'
    ) {
        const type = dto?.type ?? oldCredential.type;
        const code = dto?.code ?? oldCredential.code;
        const faceUrl = dto?.additionalDetails ?? oldCredential.additionalDetails;

        // Qurilmalarni filtrlaymiz
        const devices = employee.gates.flatMap(
            g => g.devices.filter(d => d.type.includes(type)) // To'g'ridan-to'g'ri massivni tekshiramiz
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
                await this.handleDeviceAction(
                    type,
                    action,
                    employee,
                    code,
                    faceUrl,
                    config,
                    oldCredential
                );
            } catch (e) {
                this.logger.error(
                    `[${type}] device sync error on Device ${device.id}: ${e.message}`
                );
            }
        }
    }

    private async handleDeviceAction(
        type: ActionType,
        action: string,
        employee: EmployeeWithRelations,
        code: string,
        faceUrl: string,
        config: HikvisionConfig,
        oldCredential?: CreateCredentialDto
    ) {
        // Agar QR bo'lsa, Hikvision ISAPI interfeysida u Card ID sifatida yuboriladi
        const effectiveType = type === ActionType.QR ? ActionType.CARD : type;

        switch (effectiveType) {
            case ActionType.CAR:
                if (action === 'Delete')
                    return this.hikvisionAnprService.deleteLicensePlate(code, config);
                if (action === 'Create')
                    return this.hikvisionAnprService.addLicensePlate(code, '1', config);
                return this.hikvisionAnprService.editLicensePlate(
                    oldCredential?.code || code,
                    code,
                    '1',
                    config
                );

            case ActionType.PHOTO:
                if (action === 'Delete')
                    return this.hikvisionAccessService.deleteFaceFromUser(
                        String(employee.id),
                        config
                    );

                // Yuz qo'shishdan oldin foydalanuvchi borligini tekshirish/yaratish HikvisionAccessService ichida bo'lishi kerak
                return this.hikvisionAccessService.addFaceToUserViaURL(
                    String(employee.id),
                    faceUrl,
                    config
                );

            case ActionType.PERSONAL_CODE:
                return this.hikvisionAccessService.addPasswordToUser(
                    String(employee.id),
                    action === 'Delete' ? '' : code,
                    config
                );

            case ActionType.CARD:
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
                    oldCredential?.code || code,
                    code,
                    String(employee.id),
                    config
                );
        }
    }
}
