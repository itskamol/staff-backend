import {
    Body,
    Controller,
    Get,
    NotFoundException,
    Param,
    Put,
    Post,
    Query,
    Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { User as UserModel } from '@prisma/client';
import { NoScoping, Role, Roles, User } from '@app/shared/auth';
import {
    ApiSuccessResponse,
    AssignUserToDepartmentDto,
    CreateUserDto,
    UpdateCurrentUserDto,
    UpdateUserDto,
    UserResponseDto,
} from '../../shared/dto';
import { ApiCrudOperation } from '../../shared/utils';
import { UserContext } from '../../shared/interfaces';
import { QueryDto } from '@app/shared/utils';

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
        return this.userService.createUser(createUserDto);
    }

    @Get('roles')
    @ApiCrudOperation(String as any, 'list', {
        summary: 'Get all user roles',
        arrayItemType: 'string',
        includeQueries: { pagination: false },
    })
    async getUserRoles() {
        return Object.values(Role);
    }

    @Get()
    @ApiCrudOperation(UserResponseDto, 'list', {
        summary: 'Get all users',
        includeQueries: {
            pagination: true,
            search: true,
            sort: true,
        },
    })
    async getAllUsers(@Query() query: QueryDto) {
        return this.userService.getAllUsers(query);
    }

    @Get('me')
    @ApiCrudOperation(UserResponseDto, 'get', {
        summary: 'Get current user',
    })
    async getCurrentUser(@User() user: UserContext): Promise<Omit<UserModel, 'password'>> {
        const currentUser = await this.userService.findById(+user.sub);
        if (!currentUser) {
            throw new NotFoundException('User not found');
        }
        return currentUser;
    }

    @Get(':id')
    @ApiParam({ name: 'id', description: 'ID of the user' })
    @ApiCrudOperation(UserResponseDto, 'get', {
        summary: 'Get a specific user by ID',
    })
    async getUserById(@Param('id') id: number): Promise<Omit<UserModel, 'password'>> {
        const user = await this.userService.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    @Put('me')
    @ApiCrudOperation(UserResponseDto, 'update', {
        body: UpdateCurrentUserDto,
        summary: 'Update current user',
    })
    async updateCurrentUser(
        @Body() updateUserDto: UpdateCurrentUserDto,
        @User() user: UserContext
    ): Promise<UserResponseDto> {
        return this.userService.updateCurrentUser(+user.sub, updateUserDto);
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
    ): Promise<UserResponseDto> {
        return this.userService.updateUser(id, updateUserDto, user);
    }

    @Delete(':id')
    @ApiParam({ name: 'id', description: 'ID of the user to delete' })
    @ApiCrudOperation(UserResponseDto, 'delete', {
        summary: 'Delete a user',
        errorResponses: { notFound: true },
    })
    async deleteUser(@Param('id') id: number, @User() user: UserContext): Promise<UserResponseDto> {
        return this.userService.deleteUser(id, user);
    }

    @Post(':id/assign-department')
    @ApiParam({ name: 'id', description: 'ID of the user to assign department' })
    @ApiCrudOperation(UserResponseDto, 'update', {
        body: AssignUserToDepartmentDto,
        summary: 'Assign a department to a user',
        errorResponses: { notFound: true, badRequest: true },
    })
    async assignDepartment(
        @Param('id') id: number,
        @Body() assignUserToDepartmentDto: AssignUserToDepartmentDto
    ): Promise<UserResponseDto> {
        return this.userService.assignDepartment(id, assignUserToDepartmentDto.departmentIds);
    }
}
