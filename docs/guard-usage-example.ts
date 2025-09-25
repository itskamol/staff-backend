import { Controller, Get, Post, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { 
    Public, 
    Protected, 
    WithRoles, 
    AdminOnly,
    DeviceProtected 
} from '../src/shared/guards/guard.decorators';

@Controller('example')
export class ExampleUsageController {
    
    /**
     * Public endpoint - no guards
     */
    @Public()
    @Get('public')
    getPublicData() {
        return { message: 'Public data' };
    }

    /**
     * Protected endpoint - JWT + DataScope
     */
    @Protected()
    @Get('protected')
    getProtectedData() {
        return { message: 'Protected data with data scoping' };
    }

    /**
     * Role-based endpoint - JWT + Roles + DataScope
     */
    @WithRoles(Role.HR, Role.ADMIN)
    @Get('hr-data')
    getHRData() {
        return { message: 'HR and Admin only data' };
    }

    /**
     * Admin only - JWT + Roles (no data scoping)
     */
    @AdminOnly()
    @Get('admin')
    getAdminData() {
        return { message: 'Admin only - system wide access' };
    }

    /**
     * Device protected endpoint
     */
    @DeviceProtected(Role.GUARD)
    @Post('device-action')
    deviceAction(@Body() data: any) {
        return { message: 'Device authenticated action', data };
    }
}

/**
 * USAGE COMPARISON:
 * 
 * OLD WAY (before):
 * @UseGuards(JwtAuthGuard, RolesGuard, DataScopeGuard)
 * @SetMetadata('roles', [Role.HR])
 * @Get('some-data')
 * 
 * NEW WAY (after):
 * @WithRoles(Role.HR)
 * @Get('some-data')
 * 
 * Benefits:
 * - Less imports needed
 * - Cleaner controller code
 * - Consistent guard combinations
 * - Fewer lines of code
 */