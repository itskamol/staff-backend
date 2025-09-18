import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    NotFoundException,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
    getSchemaPath,
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
import { NoScoping, Permissions, User } from '@/shared/decorators';
import { PERMISSIONS } from '@/shared/constants/permissions.constants';
import { UserContext } from '@/shared/interfaces';
import { User as UserModel } from '@prisma/client';
import { ApiOkResponseData } from '@/shared/utils';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@ApiExtraModels(
    ApiSuccessResponse,
    UserResponseDto,
)
export class UserController {
    constructor(
        private readonly userService: UserService,
    ) {}

    @Post()
    @NoScoping()
    @Permissions(PERMISSIONS.USER.CREATE_ORG_ADMIN)
    @ApiOperation({ summary: 'Create a new user' })
    @ApiBody({ type: CreateUserDto })
    @ApiResponse({
        status: 201,
        description: 'The user has been successfully created.',
        schema: {
            allOf: [
                { $ref: getSchemaPath(ApiSuccessResponse) },
                {
                    properties: {
                        data: { $ref: getSchemaPath(UserResponseDto) },
                    },
                },
            ],
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input.', type: ApiErrorResponse })
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 409, description: 'Conflict.', type: ApiErrorResponse })
    async createUser(
        @Body() createUserDto: CreateUserDto,
        @User() user: UserContext
    ): Promise<UserModel> {
        return this.userService.createUser(createUserDto, user.sub);
    }

    @Get(':id')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
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

    @Patch(':id')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
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
    ): Promise<UserModel> {
        return this.userService.updateUser(id, updateUserDto, user.sub);
    }

    @Patch(':id/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
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

    @Patch(':id/activate')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Activate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to activate' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async activateUser(@Param('id') id: number, @User() user: UserContext): Promise<UserModel> {
        return this.userService.activateUser(id, user.sub);
    }

    @Patch(':id/deactivate')
    @Permissions(PERMISSIONS.USER.MANAGE_ORG)
    @ApiOperation({ summary: 'Deactivate a user' })
    @ApiParam({ name: 'id', description: 'ID of the user to deactivate' })
    @ApiOkResponseData(UserResponseDto)
    @ApiResponse({ status: 403, description: 'Forbidden.', type: ApiErrorResponse })
    @ApiResponse({ status: 404, description: 'User not found.', type: ApiErrorResponse })
    async deactivateUser(@Param('id') id: number, @User() user: UserContext): Promise<UserModel> {
        return this.userService.deactivateUser(id, user.sub);
    }
}
