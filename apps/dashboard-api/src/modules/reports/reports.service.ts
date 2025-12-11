import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@app/shared/database';
import { Role } from '@app/shared/auth';
import { AttendanceReportDto } from './dto/reports.dto';
import { UserContext } from '../../shared/interfaces';

@Injectable()
export class ReportsService {
    constructor(private readonly prisma: PrismaService) {}

    async generateAttendanceReport(dto: AttendanceReportDto, user: UserContext): Promise<any> {
        const { departmentId } = dto;

        // Build where clause based on user role
        const whereClause: any = {};
        console.log(user);

        if (user.role === Role.HR) {
            whereClause.employee = {
                department: {
                    organizationId: user.organizationId,
                },
            };
        } else if (user.role === Role.DEPARTMENT_LEAD) {
            whereClause.employee = {
                department: {
                    id: { in: user.departmentIds || [] },
                },
            };
        }

        if (departmentId) {
            whereClause.employee = {
                ...whereClause.employee,
                departmentId,
            };
        }

        return true;
    }
}
