import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Roles, Role, User as CurrentUser } from '@app/shared/auth';
import { ApiResponseDto, PaginationDto } from '@app/shared/utils';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@Roles(Role.ADMIN)
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    @ApiOperation({ summary: 'Get all users' })
    @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
    async findAll(@Query() paginationDto: PaginationDto): Promise<ApiResponseDto> {
        const result = await this.userService.findAll(paginationDto);
        return ApiResponseDto.success(result, 'Users retrieved successfully');
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({ status: 200, description: 'User retrieved successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
        const user = await this.userService.findOne(id);
        return ApiResponseDto.success(user, 'User retrieved successfully');
    }

    @Post()
    @ApiOperation({ summary: 'Create new user' })
    @ApiResponse({ status: 201, description: 'User created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async create(@Body() createUserDto: CreateUserDto): Promise<ApiResponseDto> {
        const user = await this.userService.create(createUserDto);
        return ApiResponseDto.success(user, 'User created successfully');
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update user' })
    @ApiResponse({ status: 200, description: 'User updated successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateUserDto: UpdateUserDto
    ): Promise<ApiResponseDto> {
        const user = await this.userService.update(id, updateUserDto);
        return ApiResponseDto.success(user, 'User updated successfully');
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete user' })
    @ApiResponse({ status: 200, description: 'User deleted successfully' })
    @ApiResponse({ status: 404, description: 'User not found' })
    async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
        await this.userService.remove(id);
        return ApiResponseDto.success(null, 'User deleted successfully');
    }

    @Post(':id/assign-organization')
    @ApiOperation({ summary: 'Assign user to organization' })
    @ApiResponse({ status: 200, description: 'User assigned to organization successfully' })
    async assignOrganization(
        @Param('id', ParseIntPipe) id: number,
        @Body('organizationId', ParseIntPipe) organizationId: number
    ): Promise<ApiResponseDto> {
        const user = await this.userService.assignOrganization(id, organizationId);
        return ApiResponseDto.success(user, 'User assigned to organization successfully');
    }

    @Post(':id/change-role')
    @ApiOperation({ summary: 'Change user role' })
    @ApiResponse({ status: 200, description: 'User role changed successfully' })
    async changeRole(
        @Param('id', ParseIntPipe) id: number,
        @Body('role') role: Role
    ): Promise<ApiResponseDto> {
        const user = await this.userService.changeRole(id, role);
        return ApiResponseDto.success(user, 'User role changed successfully');
    }
}
