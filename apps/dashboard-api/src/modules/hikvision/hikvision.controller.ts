import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { HikvisionService } from './hikvision.service';
import { CreateHikvisionUserDto, HikvisionConfig } from './dto/create-hikvision-user.dto';
import { DeleteUserDto } from './dto/delete-user.dto';

@ApiTags('Hikvisions')
@ApiBearerAuth()
@Controller('hikvision')
export class HikvisionController {
  constructor(private readonly hikvisionService: HikvisionService) {}

  // ✅ Test connection
 @Post('test-connection')
  @ApiOperation({ summary: 'Hikvision qurilmasi bilan ulanishni tekshirish' })
  async testConnection(@Body() config: HikvisionConfig) {
    return await this.hikvisionService.testConnection(config);
  }

  // ✅ Qurilma haqidagi maʼlumotlarni olish
  @Post('device-info')
  @ApiOperation({ summary: 'Hikvision qurilmasi haqidagi barcha maʼlumotlarni olish' })
  async getDeviceInfo(@Body() config: HikvisionConfig) {
    return await this.hikvisionService.getDeviceInfo(config);
  }

  // ✅ User yaratish
  @Post('user')
  @ApiOperation({ summary: 'Hikvision qurilmasida user yaratish' })
  async createUser(@Body() dto: CreateHikvisionUserDto) {
    return this.hikvisionService.createUser(dto);
  }

  // ✅ Userni olish
  @Get('user/:employeeNo')
  @ApiOperation({ summary: 'User maʼlumotlarini olish' })
  async getUser(@Param('employeeNo') employeeNo: string) {
    return this.hikvisionService.getUser(employeeNo);
  }

  // ✅ Barcha userlarni olish
  @Get('users')
  @ApiOperation({ summary: 'Barcha foydalanuvchilarni olish' })
  async getAllUsers() {
    return this.hikvisionService.getAllUsers();
  }

  // ✅ Userni o‘chirish
  @Delete('user/:employeeNo')
  @ApiOperation({ summary: 'Userni o‘chirish' })
  async deleteUser(@Param('employeeNo') employeeNo: string) {
    return this.hikvisionService.deleteUser(employeeNo);
  }

  // ✅ Kartani userga qo‘shish
  @Post('user/:employeeNo/card')
  @ApiOperation({ summary: 'Userga karta qo‘shish' })
  @ApiBody({ schema: { example: { cardNo: '123456' } } })
  async addCardToUser(
    @Param('employeeNo') employeeNo: string,
    @Body('cardNo') cardNo: string,
  ) {
    return this.hikvisionService.addCardToUser(employeeNo, cardNo);
  }

  // ✅ Yuzni URL orqali qo‘shish
  @Post('user/:employeeNo/face')
  @ApiOperation({ summary: 'Userga yuz maʼlumotini URL orqali qo‘shish' })
  @ApiBody({ schema: { example: { faceURL: 'http://example.com/face.jpg' } } })
  async addFaceToUser(
    @Param('employeeNo') employeeNo: string,
    @Body('faceURL') faceURL: string,
  ) {
    return this.hikvisionService.addFaceToUserViaURL(employeeNo, faceURL);
  }

  // ✅ Access loglarni olish
  @Get('logs')
  @ApiOperation({ summary: 'Kirish/chiqish loglarini olish' })
  @ApiQuery({ name: 'startTime', required: false })
  @ApiQuery({ name: 'endTime', required: false })
  async getAccessLogs(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    return this.hikvisionService.getAccessLogs(startTime, endTime);
  }

  // ✅ Qurilmadan foydalanuvchilarni sinxronlash
  @Post('users/sync')
  @ApiOperation({ summary: 'Qurilmadan barcha userlarni sinxronlash' })
  async syncUsersFromDevice() {
    return this.hikvisionService.syncUsersFromDevice();
  }
}
