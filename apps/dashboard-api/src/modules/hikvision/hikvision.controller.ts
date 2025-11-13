import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Req,
  Res
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHideProperty,
} from '@nestjs/swagger';
import { HikvisionService } from './hikvision.service';
import { CreateHikvisionUserDto, HikvisionConfig } from './dto/create-hikvision-user.dto';
import { Public } from '@app/shared/auth';
import { Request, Response } from 'express';
import { ActionService } from '../action/service/action.service';

@ApiTags('Hikvisions')
@ApiBearerAuth()
@Controller('hikvision')
export class HikvisionController {
  constructor(private readonly hikvisionService: HikvisionService,
    private readonly actionService: ActionService,
  ) { }

  // ✅ Test connection
  @Post('test-connection')
  async testConnection(@Body() config: HikvisionConfig) {
    return await this.hikvisionService.testConnection(config);
  }

  // ✅ Qurilma haqidagi maʼlumotlarni olish
  @Post('device-info')
  async getDeviceInfo(@Body() config: HikvisionConfig) {
    return await this.hikvisionService.getDeviceInfo(config);
  }

  // ✅ User yaratish
  @Post('user')
  async createUser(@Body() dto: CreateHikvisionUserDto, @Body() config: HikvisionConfig) {
    return this.hikvisionService.createUser(dto, config);
  }

  @Post('capabilities')
  @ApiOperation({ summary: 'Get hikvision capabilities' })
  async getDeviceCapabilities(@Body() dto: HikvisionConfig) {
    return this.hikvisionService.getDeviceCapabilities(dto);
  }

  @Post('user/:employeeNo')
  @ApiOperation({ summary: 'Get user info' })
  async getUser(@Param('employeeNo') employeeNo: string, @Body() config: HikvisionConfig) {
    return this.hikvisionService.getUser(employeeNo, config);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers() {
    // return this.hikvisionService.getAllUsers();
    return 'Hikvisions employees'
  }

  @Delete('user/:employeeNo')
  @ApiOperation({ summary: 'Delete User' })
  async deleteUser(@Param('employeeNo') employeeNo: string) {
    // return this.hikvisionService.deleteUser(employeeNo);
  }

  // ✅ Kartani userga qo‘shish
  // @Post('user/:employeeNo/card')
  // @ApiOperation({ summary: 'Userga karta qo‘shish' })
  // @ApiBody({ schema: { example: { cardNo: '123456' } } })
  // async addCardToUser(
  //   @Param('employeeNo') employeeNo: string,
  //   @Body('cardNo') cardNo: string,
  // ) {
  //   return this.hikvisionService.addCardToUser(employeeNo, cardNo);
  // }

  // ✅ Yuzni URL orqali qo‘shish
  // @Post('user/:employeeNo/face')
  // @ApiOperation({ summary: 'Userga yuz maʼlumotini URL orqali qo‘shish' })
  // @ApiBody({ schema: { example: { faceURL: 'http://example.com/face.jpg' } } })
  // async addFaceToUser(
  //   @Param('employeeNo') employeeNo: string,
  //   @Body('faceURL') faceURL: string,
  //   @Body() config: HikvisionConfig
  // ) {
  //   return this.hikvisionService.addFaceToUserViaURL(employeeNo, faceURL, config);
  // }


  // @Get('logs')
  // @ApiOperation({ summary: 'Kirish/chiqish loglarini olish' })
  // @ApiQuery({ name: 'startTime', required: false })
  // @ApiQuery({ name: 'endTime', required: false })
  // async getEventHost(
  //   @Query('startTime') startTime?: string,
  //   @Query('endTime') endTime?: string,
  // ) {
  //   return this.hikvisionService.getAccessLogs(startTime, endTime);
  // }


  @Post('event/:id')
  @Public()
  async receiveEvent(@Req() req: Request, @Res() res: Response, @Param('id') deviceId: string) {
    const raw = (req as any).rawBody;
    const str = raw ? raw.toString('utf8') : '';

    let eventData: any = null;

    try {
      if (req.headers['content-type']?.includes('multipart/form-data')) {
        const match = str.match(/name="event_log"\s*\r?\n\r?\n([\s\S]*?)\r?\n--/);
        if (match) {
          eventData = JSON.parse(match[1]);
        }
      } else if (req.headers['content-type']?.includes('application/json')) {
        eventData = JSON.parse(str);
      }
    } catch (err) {
      console.error('Event parse error:', err.message);
    }

    const eployeeID = eventData?.AccessControllerEvent?.employeeNoString
    if (eployeeID) {  
      await this.actionService.create(eventData, +deviceId);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send({ responseStatusStrg: 'OK' });
  }


  // ✅ Qurilmadan foydalanuvchilarni sinxronlash
  // @Post('users/sync')
  // @ApiOperation({ summary: 'Qurilmadan barcha userlarni sinxronlash' })
  // async syncUsersFromDevice() {
  //   return this.hikvisionService.syncUsersFromDevice();
  // }
}
