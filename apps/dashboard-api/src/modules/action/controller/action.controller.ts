// ...existing code...
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ActionService } from '../service/action.service';
import { ActionQueryDto, CreateActionDto, UpdateActionDto } from '../dto/action.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';


@ApiTags('Actions')
@ApiBearerAuth()
@Controller('action')
export class ActionController {
  constructor(private readonly service: ActionService) { }

  @Get()
  async findAll(
    @Query() dto?: ActionQueryDto
  ) {
    return this.service.findAll(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateActionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}