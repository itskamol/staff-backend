import { DataScope } from './data-scope.interface';

export interface BaseRepository<T, CreateDto, UpdateDto> {
    create(data: CreateDto, scope: DataScope): Promise<T>;
    findById(id: string, scope: DataScope): Promise<T | null>;
    findMany(filters: any, scope: DataScope): Promise<T[]>;
    update(id: string, data: UpdateDto, scope: DataScope): Promise<T>;
    delete(id: string, scope: DataScope): Promise<void>;
    count(filters: any, scope: DataScope): Promise<number>;
}
