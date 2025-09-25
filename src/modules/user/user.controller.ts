import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Put,
    Post,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
    getSchemaPath,
    OmitType,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import {
    ApiErrorResponse,
    ApiSuccessResponse,
    ChangePasswordDto,
    CreateUserDto,
    UpdateUserDto,
    UserResponseDto,
} from '@/shared/dto';
import { NoScoping, Roles, User } from '@/shared/decorators';
import { UserContext } from '@/shared/interfaces';
import { Prisma, Role, User as UserModel } from '@prisma/client';
import { ApiErrorResponses, ApiOkResponseData, ApiQueries, ApiCrudOperation } from '@/shared/utils';

@ApiTags('Users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
@ApiExtraModels(ApiSuccessResponse, UserResponseDto)
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post()
    @NoScoping()
    @ApiCrudOperation(UserResponseDto, 'create', {
        body: CreateUserDto,
        summary: 'Create a new user',
        errorResponses: { badRequest: true, conflict: true },
    })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.createUser(createUserDto, user.sub);
    }

    @Get()
    @ApiCrudOperation(UserResponseDto, 'list', {
        summary: 'Get all users',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
            filters: ['isActive'],
        },
    })
    async getAllUsers(): Promise<Omit<UserModel, 'password'>[]> {
        return this.userService.getAllUsers();
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiCrudOperation(UserResponseDto, 'get', {
        summary: 'Get a specific user by ID',
    })
    async getUserById(@Param('id') id: number): Promise<UserModel> {
        const user = await this.userService.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    @Put(':id')
    @ApiParam({ name: 'id', description: 'ID of the user to update' })
    @ApiCrudOperation(UserResponseDto, 'update', {
        body: UpdateUserDto,
        summary: 'Update a user',
    })
    async updateUser(
        @Param('id') id: number,
        @Body() updateUserDto: UpdateUserDto,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.updateUser(id, updateUserDto, user.sub);
    }

    @Put(':id/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiParam({ name: 'id', description: 'ID of the user to change password' })
    @ApiCrudOperation(UserResponseDto, 'update', {
        body: ChangePasswordDto,
        summary: 'Change a user password',
        errorResponses: { forbidden: true, notFound: true },
    })
    async changeUserPassword(
        @Param('id') id: number,
        @Body() changePasswordDto: ChangePasswordDto,
        @User() user: UserContext
    ): Promise<void> {
        await this.userService.changePassword(id, changePasswordDto, user.sub);
    }

    @Put(':id/activate')
    @ApiParam({ name: 'id', description: 'ID of the user to activate' })
    @ApiCrudOperation(UserResponseDto, 'update', {
        summary: 'Activate a user',
    })
    async activateUser(
        @Param('id') id: number,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.activateUser(id, user.sub);
    }

    @Put(':id/deactivate')
    @ApiParam({ name: 'id', description: 'ID of the user to deactivate' })
    @ApiCrudOperation(UserResponseDto, 'update', {
        summary: 'Deactivate a user',
        body: OmitType(UpdateUserDto, ['isActive'] as const),
        errorResponses: { forbidden: true, notFound: true },
    })
    async deactivateUser(
        @Param('id') id: number,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.deactivateUser(id, user.sub);
    }
}
