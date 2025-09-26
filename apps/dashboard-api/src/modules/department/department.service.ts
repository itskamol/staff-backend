import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@staff-control-system/shared/database';
import { Role } from '@staff-control-system/shared/auth';
import { QueryBuilderUtil, PaginationDto } from '@staff-control-system/shared/utils';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(paginationDto: PaginationDto, user: any) {
    const query = QueryBuilderUtil.buildQuery(paginationDto);

    // Apply role-based filtering
    if (user.role === Role.HR) {
      query.where.organizationId = user.organizationId;
    } else if (user.role === Role.DEPARTMENT_LEAD) {
      query.where.id = { in: user.departmentIds || [] };
    }

    const [departments, totalRecords] = await Promise.all([
      this.prisma.department.findMany({
        ...query,
        select: {
          id: true,
          organizationId: true,
          parentId: true,
          fullName: true,
          shortName: true,
          address: true,
          phone: true,
          email: true,
          additionalDetails: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          organization: {
            select: {
              id: true,
              fullName: true,
              shortName: true,
            },
          },
          parent: {
            select: {
              id: true,
              fullName: true,
              shortName: true,
            },
          },
          _count: {
            select: {
              children: true,
              employees: true,
            },
          },
        },
      }),
      this.prisma.department.count({ where: query.where }),
    ]);

    return QueryBuilderUtil.buildResponse(
      departments,
      totalRecords,
      paginationDto.page || 1,
      paginationDto.limit || 10,
    );
  }

  async findOne(id: number, user: any) {
    // Check access permissions
    if (user.role === Role.DEPARTMENT_LEAD && !user.departmentIds?.includes(id)) {
      throw new ForbiddenException('Access denied to this department');
    }

    const department = await this.prisma.department.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        fullName: true,
        shortName: true,
        address: true,
        phone: true,
        email: true,
        additionalDetails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
          },
        },
        parent: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
          },
        },
        _count: {
          select: {
            children: true,
            employees: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    // Additional access check for HR
    if (user.role === Role.HR && department.organizationId !== user.organizationId) {
      throw new ForbiddenException('Access denied to this department');
    }

    return department;
  }

  async create(createDepartmentDto: CreateDepartmentDto, user: any) {
    // For HR users, auto-assign their organization
    if (user.role === Role.HR) {
      createDepartmentDto.organizationId = user.organizationId;
    }

    // Verify organization access
    if (user.role === Role.HR && createDepartmentDto.organizationId !== user.organizationId) {
      throw new ForbiddenException('Cannot create department in different organization');
    }

    // Check if organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: createDepartmentDto.organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Check parent department if provided
    if (createDepartmentDto.parentId) {
      const parentDepartment = await this.prisma.department.findUnique({
        where: { id: createDepartmentDto.parentId },
      });

      if (!parentDepartment) {
        throw new NotFoundException('Parent department not found');
      }

      if (parentDepartment.organizationId !== createDepartmentDto.organizationId) {
        throw new ForbiddenException('Parent department must be in the same organization');
      }
    }

    const department = await this.prisma.department.create({
      data: createDepartmentDto,
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        fullName: true,
        shortName: true,
        address: true,
        phone: true,
        email: true,
        additionalDetails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
          },
        },
      },
    });

    return department;
  }

  async update(id: number, updateDepartmentDto: UpdateDepartmentDto, user: any) {
    // Check if department exists and access permissions
    const existingDepartment = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!existingDepartment) {
      throw new NotFoundException('Department not found');
    }

    // Check access permissions
    if (user.role === Role.HR && existingDepartment.organizationId !== user.organizationId) {
      throw new ForbiddenException('Access denied to this department');
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
      select: {
        id: true,
        organizationId: true,
        parentId: true,
        fullName: true,
        shortName: true,
        address: true,
        phone: true,
        email: true,
        additionalDetails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            fullName: true,
            shortName: true,
          },
        },
      },
    });

    return department;
  }

  async remove(id: number, user: any) {
    // Check if department exists and access permissions
    const existingDepartment = await this.prisma.department.findUnique({
      where: { id },
      include: {
        children: true,
        employees: true,
      },
    });

    if (!existingDepartment) {
      throw new NotFoundException('Department not found');
    }

    // Check access permissions
    if (user.role === Role.HR && existingDepartment.organizationId !== user.organizationId) {
      throw new ForbiddenException('Access denied to this department');
    }

    // Check if department has dependencies
    if (existingDepartment.children.length > 0 || existingDepartment.employees.length > 0) {
      // Soft delete
      await this.prisma.department.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete
      await this.prisma.department.delete({
        where: { id },
      });
    }
  }

  async getSubDepartments(id: number, paginationDto: PaginationDto, user: any) {
    // Check access permissions first
    await this.findOne(id, user);

    const query = QueryBuilderUtil.buildQuery(paginationDto);
    query.where.parentId = id;

    const [subDepartments, totalRecords] = await Promise.all([
      this.prisma.department.findMany({
        ...query,
        select: {
          id: true,
          fullName: true,
          shortName: true,
          address: true,
          phone: true,
          email: true,
          additionalDetails: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              children: true,
              employees: true,
            },
          },
        },
      }),
      this.prisma.department.count({ where: query.where }),
    ]);

    return QueryBuilderUtil.buildResponse(
      subDepartments,
      totalRecords,
      paginationDto.page || 1,
      paginationDto.limit || 10,
    );
  }

  async getEmployees(id: number, paginationDto: PaginationDto, user: any) {
    // Check access permissions first
    await this.findOne(id, user);

    const query = QueryBuilderUtil.buildQuery(paginationDto);
    query.where.departmentId = id;

    const [employees, totalRecords] = await Promise.all([
      this.prisma.employee.findMany({
        ...query,
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          photo: true,
          additionalDetails: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          policy: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      this.prisma.employee.count({ where: query.where }),
    ]);

    return QueryBuilderUtil.buildResponse(
      employees,
      totalRecords,
      paginationDto.page || 1,
      paginationDto.limit || 10,
    );
  }
}