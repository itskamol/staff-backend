import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { HikvisionCoreService } from '../core/hikvision.core.service';
import { ConfigService } from 'apps/dashboard-api/src/core/config/config.service';
import { XmlJsonService } from 'apps/dashboard-api/src/shared/services/xtml-json.service';
import { HikvisionConfig } from '../dto/create-hikvision-user.dto';

@Injectable()
export class HikvisionAnprService {
    private readonly logger = new Logger(HikvisionAnprService.name);

    constructor(
        private readonly coreService: HikvisionCoreService,
        private readonly configService: ConfigService,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    // SEARCH
    async searchLicensePlates(config: HikvisionConfig, plateNo?: string): Promise<any[]> {
        this.coreService.setConfig(config);
        const searchUUID = crypto.randomUUID();
        const plateFilterXml = plateNo ? `<LicensePlate>${plateNo}</LicensePlate>` : '';
        const maxResults = plateNo ? 1 : 50;

        const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
        <LPListAuditSearchDescription>
            <searchID>${searchUUID}</searchID>
            <maxResults>${maxResults}</maxResults>
            <searchResultPosition>0</searchResultPosition>
            ${plateFilterXml}
        </LPListAuditSearchDescription>`;

        try {
            const response = await this.coreService.request(
                'POST',
                '/ISAPI/Traffic/channels/1/searchLPListAudit',
                xmlBody
            );

            let resultData = response.data;
            if (typeof resultData === 'string') {
                const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: true });
                resultData = parser.parse(resultData);
            }

            const root = resultData?.LPListAuditSearchResult || resultData;
            const list = root?.LicensePlateInfoList?.LicensePlateInfo;

            if (list) {
                return Array.isArray(list) ? list : [list];
            }
            return [];
        } catch (error) {
            this.logger.error(`ANPR Search Error: ${error.message}`);
            return [];
        }
    }

    // FIND ID
    private async findPlateId(plateNo: string, config: HikvisionConfig): Promise<string | null> {
        const results = await this.searchLicensePlates(config, plateNo);
        if (results.length > 0) {
            return results[0].id ? results[0].id.toString() : null;
        }
        return null;
    }

    // ADD / EDIT Helper
    private async sendRecordRequest(body: any): Promise<boolean> {
        const response = await this.coreService.request(
            'PUT',
            '/ISAPI/Traffic/channels/1/licensePlateAuditData/record?format=json',
            body
        );
        return response.status === 200;
    }

    // ADD
    async addLicensePlate(
        plateNo: string,
        listType: string = '1',
        config: HikvisionConfig
    ): Promise<boolean> {
        this.coreService.setConfig(config);

        const existingId = await this.findPlateId(plateNo, config);
        if (existingId) {
            return true;
        }

        const body = this.createRecordBody(plateNo, listType, '');

        this.logger.log(
            `Adding license plate: ${plateNo} to ${listType === '2' ? 'blacklist' : 'whitelist'}`
        );
        return this.sendRecordRequest(body);
    }

    // EDIT
    async editLicensePlate(
        oldPlateNo: string,
        newPlateNo: string,
        listType: string,
        config: HikvisionConfig
    ): Promise<boolean> {
        this.coreService.setConfig(config);
        const id = await this.findPlateId(oldPlateNo, config);
        if (!id) throw new BadRequestException(`Raqam topilmadi: ${oldPlateNo}`);

        const body = this.createRecordBody(newPlateNo, listType, id);
        return this.sendRecordRequest(body);
    }

    // DELETE
    async deleteLicensePlate(plateNo: string, config: HikvisionConfig): Promise<boolean> {
        this.coreService.setConfig(config);
        const id = await this.findPlateId(plateNo, config);
        if (!id) return false;

        const body = { id: [id] };
        const response = await this.coreService.request(
            'PUT',
            '/ISAPI/Traffic/channels/1/DelLicensePlateAuditData?format=json',
            body
        );
        return response.status === 200;
    }

    // EVENTS
    async configureAnprEventHost(config: HikvisionConfig, deviceId: number): Promise<any> {
        this.coreService.setConfig(config);
        const serverHost = this.configService.hostIp;
        const serverPort = this.configService.port;
        const eventUrl = `http://${serverHost}:${serverPort}/api/v1/hikvision/anpr-event/${deviceId}`;
        this.logger.log(`Event URL: ${eventUrl}`, 'ANPRService');

        const jsonBody = {
            HttpHostNotification: {
                id: 1,
                url: eventUrl,
                protocolType: 'HTTP',
                parameterFormatType: 'JSON',
                addressingFormatType: 'ipaddress',
                host: serverHost,
                portNo: serverPort,
                ipAddress: serverHost,
                httpAuthenticationMethod: 'none',
                eventTypeList: { eventType: ['TrafficVehicleObservation'] },
                uploadImagesDataType: 'URL',
            },
        };

        this.logger.log('✅ Hikvision event listening host muvaffaqiyatli sozlandi', 'ANPRSerive');
        const xmlBody = this.xmlJsonService.jsonToXml(jsonBody, 'HttpHostNotification', {
            format: { pretty: true },
        });
        return this.coreService.request('PUT', '/ISAPI/Event/notification/httpHosts/1', xmlBody);
    }

    private createRecordBody(plateNo: string, listType: string, id: string) {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const nowStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .split('.')[0];
        const typeStr = listType === '2' || listType === 'blackList' ? 'blackList' : 'whiteList';

        return {
            LicensePlateInfoList: [
                {
                    id: id,
                    LicensePlate: plateNo,
                    listType: typeStr,
                    createTime: nowStr,
                    effectiveStartDate: todayStr,
                    effectiveTime: '2035-12-31',
                },
            ],
        };
    }
}
