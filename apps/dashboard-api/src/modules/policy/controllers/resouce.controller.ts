import { Controller } from '@nestjs/common';
import { Resource } from '@prisma/client';
import { BaseCrudController } from 'apps/dashboard-api/src/shared/controllers/base.controller';
import { CreateResourceDto, ResourceResponseDto, UpdateResourceDto } from '../dto/resource.dto';

@Controller('resources')
export class ResourceController extends BaseCrudController<
    Resource,
    CreateResourceDto,
    UpdateResourceDto,
    typeof ResourceResponseDto,
    any
> {
    protected entityName = 'resource';
    protected responseDto: typeof ResourceResponseDto = ResourceResponseDto;
}
