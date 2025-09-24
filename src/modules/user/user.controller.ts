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
import { ApiErrorResponses, ApiOkResponseData, ApiQueries } from '@/shared/utils';

@ApiTags('Users')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('users')
@ApiExtraModels(ApiSuccessResponse, UserResponseDto)
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Post()
    @NoScoping()
    @ApiOperation({ summary: 'Create a new user' })
    @ApiBody({ type: CreateUserDto })
    @ApiOkResponseData(UserResponseDto)
    @ApiErrorResponses({ badRequest: true, conflict: true })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.createUser(createUserDto, user.sub);
    }

    @Get()
    @ApiOperation({ summary: 'Get all users' })
    @ApiOkResponseData(UserResponseDto)
    @ApiQueries({ search: true, sort: true }, [
        { name: 'isActive', required: false, type: Boolean },
    ])
    @ApiErrorResponses()
    async getAllUsers(): Promise<Omit<UserModel, 'password'>[]> {
        return this.userService.getAllUsers();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific user by ID' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async getUserById(@Param('id') id: number): Promise<UserModel> {
        const user = await this.userService.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to update' })
    @ApiBody({ type: UpdateUserDto })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async updateUser(
        @Param('id') id: number,
        @Body() updateUserDto: UpdateUserDto,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.updateUser(id, updateUserDto, user.sub);
    }

    @Put(':id/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Change a user’s password' })
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiBody({ type: ChangePasswordDto })
    @ApiResponse({ status: 204, description: 'Password changed successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async changeUserPassword(
        @Param('id') id: number,
        @Body() changePasswordDto: ChangePasswordDto,
        @User() user: UserContext
    ): Promise<void> {
        await this.userService.changePassword(id, changePasswordDto, user.sub);
    }

    @Put(':id/activate')
    @ApiOperation({ summary: 'Activate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to activate' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async activateUser(
        @Param('id') id: number,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.activateUser(id, user.sub);
    }

    @Put(':id/deactivate')
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to deactivate' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async deactivateUser(
        @Param('id') id: number,
        @User() user: UserContext
    ): Promise<Omit<UserModel, 'password'>> {
        return this.userService.deactivateUser(id, user.sub);
    }
}
