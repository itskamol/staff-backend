import { Controller, Post, Param, Req, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '@app/shared/auth';
import { Request, Response } from 'express';
import { ActionService } from '../../action/service/action.service';
import { LoggerService } from '../../../core/logger';
import { XmlJsonService } from '../../../shared/services/xtml-json.service';
import { CredentialRepository } from '../../credential/repositories/credential.repository';

@ApiTags('Hikvisions')
@ApiBearerAuth()
@Controller('hikvision')
export class HikvisionController {
    constructor(
        private readonly actionService: ActionService,
        private readonly logger: LoggerService,
        private readonly xmlJsonService: XmlJsonService,
        private readonly credentailsService: CredentialRepository
    ) {}

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

        const employeeID = eventData?.AccessControllerEvent?.employeeNoString;
        if (employeeID) {
            await this.actionService.create(eventData, +deviceId, +employeeID);
        }

        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send({ responseStatusStrg: 'OK' });
    }

    @Post('anpr-event/:id')
    @Public()
    async receiveAnprEvent(
        @Req() req: Request,
        @Res() res: Response,
        @Param('id') deviceId: string
    ) {
        const raw = (req as any).rawBody;
        const str = raw.toString('utf8');

        let eventData: any = null;

        const boundaryMatch = str.match(/--([^\r\n]+)/);
        if (!boundaryMatch) {
            console.error('Boundary not found');
            return res.status(400).json({ error: 'Invalid multipart format' });
        }

        const boundary = boundaryMatch[1];
        const parts = str.split(`--${boundary}`);

        for (const part of parts) {
            if (part.includes('Content-Type: text/xml')) {
                const xmlBodyMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
                if (xmlBodyMatch) {
                    const xmlString = xmlBodyMatch[1].trim();
                    try {
                        eventData = await this.xmlJsonService.xmlToJson(xmlString);

                        const { originalLicensePlate, licensePlate, vehicleListName } =
                            eventData?.EventNotificationAlert?.ANPR;

                        const plateNo = originalLicensePlate || licensePlate;
                        console.log('number: ', plateNo);

                        if (plateNo && vehicleListName == 'whiteList') {
                            this.logger.log(`Successfully enter: ${plateNo}`, 'HikvisionService');
                            const emp = await this.credentailsService.findFirst({ code: plateNo });
                            if (emp?.employeeId) {
                                await this.actionService.create(
                                    eventData,
                                    +deviceId,
                                    emp?.employeeId
                                );
                            }
                        }
                    } catch (err) {
                        this.logger.error('XML parse error:', err.message, 'ANPRService');
                    }
                    break;
                }
            }
        }

        if (!eventData) {
            this.logger.error('XML not found in multipart body', '', 'ANPRService');
        }

        return res.status(200).json({ responseStatusStrg: 'OK', data: eventData });
    }
}
