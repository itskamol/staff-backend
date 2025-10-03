import { Injectable } from "@nestjs/common";
import { Resource } from "@prisma/client";
import { BaseCrudService } from "apps/dashboard-api/src/shared/services/base.service";
import { CreateResourceDto, ResourceResponseDto, UpdateResourceDto } from "../dto/resource.dto";
import { ResourceRepository } from "../repositories/resource.repository";
import { LoggerService } from "apps/dashboard-api/src/core/logger";


@Injectable()
export class ResourceService extends BaseCrudService<Resource, CreateResourceDto, UpdateResourceDto, ResourceRepository> {
    protected entityName: string = 'Resource';

    constructor(
        private readonly resourceRepository: ResourceRepository,
        private readonly loggerService: LoggerService
    ) {
        super(resourceRepository, loggerService);
    }

    protected mapToResponseDto(entity: Resource): ResourceResponseDto {
        return {
            id: entity.id,
            value: entity.value,
            type: entity.type,
            createdAt: entity.createdAt,
        };
    }
    
}