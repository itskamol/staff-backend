import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { LoggerService } from '../../core/logger';
import { CreateUserDto, UpdateCurrentUserDto, UpdateUserDto } from './dto';
import { PasswordUtil } from '../../shared/utils';
import { QueryDto } from '../../shared/dto/query.dto';
import { PrismaService } from '@app/shared/database';
import { UserContext } from '@app/shared/auth';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly prisma: PrismaService,
        private readonly logger: LoggerService
    ) {}

    /**
     * Create a new user
     */
    async createUser(createUserDto: CreateUserDto): Promise<Omit<User, 'password'>> {
        const { departmentIds, organizationId, password, ...userData } = createUserDto;

        const existingUser = await this.userRepository.findFirst({
            username: userData.username,
        });
        if (existingUser) {
            throw new ConflictException('Username already exists');
        }

        const passwordHash = await this.validateAndHashPassword(password);

        if (userData.role === 'DEPARTMENT_LEAD' && (!departmentIds || departmentIds.length === 0)) {
            throw new BadRequestException('departmentIds is required for DEPARTMENT_LEAD');
        }

        const createInput: Prisma.UserCreateInput = {
            ...userData,
            password: passwordHash,
            organization: organizationId
                ? {
                      connect: { id: organizationId },
                  }
                : undefined,
            departments:
                userData.role === 'DEPARTMENT_LEAD' && departmentIds?.length
                    ? {
                          connect: departmentIds.map(id => ({ id })),
                      }
                    : undefined,
        };

        const user = await this.userRepository.create(createInput);

        this.logger.logUserAction(user.id, 'USER_CREATED', {
            username: user.username,
        });

        return user;
    }

    /**
     * Find user by ID
     */
    async findById(id: number): Promise<Omit<User, 'password'>> {
        const { password, ...user } = await this.userRepository.findById(id, {
            departments: { select: { id: true, fullName: true, shortName: true } },
        });
        return user;
    }

    /**
     * Find user by email
     */
    async findByUsername(username: string): Promise<User | null> {
        return this.userRepository.findFirst({ username });
    }

    /**
     * Update user
     */
    async updateUser(
        id: number,
        updateUserDto: UpdateUserDto,
        user: UserContext
    ): Promise<Omit<User, 'password'>> {
        const existingUser = await this.userRepository.findById(id);
        if (!existingUser) throw new NotFoundException('User not found');

        if (+user.sub === id) {
            throw new ConflictException('You cannot update your own profile via admin panel');
        }

        const { departmentIds, ...dataToUpdate } = updateUserDto;

        if (dataToUpdate.password) {
            dataToUpdate.password = await this.validateAndHashPassword(dataToUpdate.password);
        }

        let departmentUpdate: Prisma.DepartmentUpdateManyWithoutUsersNestedInput | undefined =
            undefined;
        const finalRole = dataToUpdate.role || existingUser.role;

        if (finalRole === 'DEPARTMENT_LEAD') {
            if (departmentIds) {
                if (departmentIds.length === 0) {
                    throw new BadRequestException('departmentIds is required for DEPARTMENT_LEAD');
                }
                departmentUpdate = {
                    set: departmentIds.map(id => ({ id })),
                };
            }
        } else {
            departmentUpdate = { set: [] };
        }

        const updatedUser = await this.userRepository.update(id, {
            ...dataToUpdate,
            departments: departmentUpdate,
        });

        this.logger.logUserAction(id, 'USER_UPDATED', {
            changes: updateUserDto,
        });

        return updatedUser;
    }

    async updateCurrentUser(
        id: number,
        { currentPassword, newPassword, ...updateUserData }: UpdateCurrentUserDto
    ): Promise<Omit<User, 'password'>> {
        const updateUserDto: Prisma.UserUpdateInput = updateUserData;

        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (currentPassword && newPassword) {
            const isPasswordValid = await PasswordUtil.compare(currentPassword, user.password);

            if (!isPasswordValid) {
                throw new ConflictException('Current password is incorrect');
            }

            updateUserDto.password = await this.validateAndHashPassword(newPassword);
        }

        return this.userRepository.update(id, updateUserDto);
    }

    async assignDepartment(id: number, departmentIds: number[]): Promise<Omit<User, 'password'>> {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.role !== Role.DEPARTMENT_LEAD) {
            throw new ConflictException(
                'Only users with DEPARTMENT_LEAD role can be assigned departments'
            );
        }

        await this.userRepository.update(id, {
            departments: {
                connect: departmentIds.map(deptId => ({ id: deptId })),
            },
        });

        return this.findById(id);
    }

    async getAllUsers({ search, isActive, sort, order, page, limit }: QueryDto) {
        const filters: Prisma.UserWhereInput = {};
        if (search) {
            filters.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (isActive) filters.isActive = isActive;

        return this.userRepository.findManyWithPagination(
            filters,
            { [sort]: order },
            { departments: { select: { id: true }, where: { deletedAt: null } } },
            { page, limit }
        );
    }

    async deleteUser(id: number, user: UserContext): Promise<Omit<User, 'password'>> {
        if (+user.sub === id) throw new ConflictException('User cannot delete themselves');

        const existingUser = await this.userRepository.findById(id);
        if (!existingUser) {
            throw new NotFoundException('User not found');
        }

        const { password, ...deletedUser } = await this.userRepository.softDelete(id);

        this.logger.logUserAction(id, 'USER_DELETED', {
            username: deletedUser.username,
        });

        return deletedUser;
    }

    private validateAndHashPassword(password: string): Promise<string> {
        // Validate password strength
        const passwordValidation = PasswordUtil.validatePassword(password);
        if (!passwordValidation.isValid) {
            throw new ConflictException(
                `Password validation failed: ${passwordValidation.errors.join(', ')}`
            );
        }

        // Hash password
        return PasswordUtil.hash(password);
    }
}
