import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@staff-control-system/shared/database';
import { Role } from '@staff-control-system/shared/auth';
import { QueryBuilderUtil, PaginationDto } from '@staff-control-system/shared/utils';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(paginationDto: PaginationDto, user: any) {
    const query = QueryBuilderUtil.buildQuery(paginationDto);

    // Apply role-based filtering
    if (user.role === Role.HR) {
      query.where.id = user.organizationId;
    }

    const [organizations, totalRecords] = await Promise.all([
      this.prisma.organization.findMany({
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
              departments: true,
              users: true,
            },
          },
        },
      }),
      this.prisma.organization.count({ where: query.where }),
    ]);

    return QueryBuilderUtil.buildResponse(
      organizations,
      totalRecords,
      paginationDto.page || 1,
      paginationDto.limit || 10,
    );
  }

  async findOne(id: number, user: any) {
    // Check access permissions
    if (user.role === Role.HR && user.organizationId !== id) {
      throw new ForbiddenException('Access denied to this organization');
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        fullName: true,
        shortName: true,
        address: true,
        phone: true,
        email: true,
        logo: true,
        additionalDetails: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            departments: true,
            users: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async create(createOrganizationDto: CreateOrganizationDto) {
    const { shortName, email } = createOrganizationDto;

    // Check if shortName already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { shortName },
    });

    if (existingOrg) {
      throw new ConflictException('Organization short name already exists');
    }

    const organization = await this.prisma.organization.create({
      data: createOrganizationDto,
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
      },
    });

    return organization;
  }

  async update(id: number, updateOrganizationDto: UpdateOrganizationDto) {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!existingOrg) {
      throw new NotFoundException('Organization not found');
    }

    // Check if shortName is being changed and already exists
    if (updateOrganizationDto.shortName && updateOrganizationDto.shortName !== existingOrg.shortName) {
      const duplicateOrg = await this.prisma.organization.findUnique({
        where: { shortName: updateOrganizationDto.shortName },
      });

      if (duplicateOrg) {
        throw new ConflictException('Organization short name already exists');
      }
    }

    const organization = await this.prisma.organization.update({
      where: { id },
      data: updateOrganizationDto,
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
      },
    });

    return organization;
  }

  async remove(id: number) {
    // Check if organization exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        departments: true,
        users: true,
      },
    });

    if (!existingOrg) {
      throw new NotFoundException('Organization not found');
    }

    // Check if organization has dependencies
    if (existingOrg.departments.length > 0 || existingOrg.users.length > 0) {
      // Soft delete
      await this.prisma.organization.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      // Hard delete
      await this.prisma.organization.delete({
        where: { id },
      });
    }
  }

  async getDepartments(id: number, paginationDto: PaginationDto, user: any) {
    // Check access permissions
    if (user.role === Role.HR && user.organizationId !== id) {
      throw new ForbiddenException('Access denied to this organization');
    }

    const query = QueryBuilderUtil.buildQuery(paginationDto);
    query.where.organizationId = id;

    const [departments, totalRecords] = await Promise.all([
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
              employees: true,
              children: true,
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
}