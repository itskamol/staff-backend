import { Injectable } from '@nestjs/common';
import { ClassConstructor, plainToInstance } from 'class-transformer';
import { PaginationResponseDto } from '@app/shared/utils';

@Injectable()
export class PaginationService {
    constructor() {}

    async paginate<T, DTO = T>(
        dataPromise: Promise<T[]>,
        totalPromise: Promise<number>,
        page: number,
        limit: number,
        dtoClass?: ClassConstructor<DTO>
    ): Promise<PaginationResponseDto<DTO>> {
        const [data, total] = await Promise.all([dataPromise, totalPromise]);

        const transformed = dtoClass
            ? (plainToInstance(dtoClass, data) as DTO[])
            : (data as unknown as DTO[]);

        return new PaginationResponseDto<DTO>(transformed, total, page, limit);
    }
}