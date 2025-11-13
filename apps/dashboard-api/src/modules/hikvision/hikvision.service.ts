import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios, { Method, type AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import {
    CreateHikvisionUserDto,
    HikvisionConfig,
    HikvisionUser,
} from './dto/create-hikvision-user.dto';
import { XMLParser } from 'fast-xml-parser';
import FormData from 'form-data';
import * as xml2js from 'xml2js';
import { ConfigService } from '../../core/config/config.service';
import { EmployeeRepository } from '../employee/repositories/employee.repository';
import { XmlJsonService } from '../../shared/services/xtml-json.service';
import { EncryptionService } from '../../shared/services/encryption.service';

@Injectable()
export class HikvisionService {
    private readonly logger = new Logger(HikvisionService.name);
    private httpClient: AxiosInstance;
    private config: HikvisionConfig;
    private parser: xml2js.Parser;

    constructor(
        private configService: ConfigService,
        private readonly employeeRepo: EmployeeRepository,
        private readonly xmlJsonService: XmlJsonService,
        private readonly ecryptionService: EncryptionService
    ) {
        this.parser = new xml2js.Parser({ explicitArray: false });
        this.logger.log(`HikvisionService initialized`);
    }

    setConfig(config: HikvisionConfig) {
        const decryptedPassword = this.ecryptionService.decrypt(config.password);

        this.config = {
            ...config,
            password: decryptedPassword,
        };

        this.httpClient = axios.create({
            baseURL: `${config.protocol}://${config.host}:${config.port}`,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/xml',
                Accept: 'application/xml',
            },
        });
    }

    private generateDigestAuth(method: string, uri: string, wwwAuthenticate: string): string {
        const authDetails = this.parseWWWAuthenticate(wwwAuthenticate);

        const ha1 = crypto
            .createHash('md5')
            .update(`${this.config.username}:${authDetails.realm}:${this.config.password}`)
            .digest('hex');

        const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');

        const response = crypto
            .createHash('md5')
            .update(`${ha1}:${authDetails.nonce}:${ha2}`)
            .digest('hex');

        return `Digest username="${this.config.username}", realm="${authDetails.realm}", nonce="${authDetails.nonce}", uri="${uri}", response="${response}"`;
    }

    private parseWWWAuthenticate(wwwAuthenticate: string): any {
        const authDetails: any = {};
        const regex = /(\w+)="([^"]+)"/g;
        let match;

        while ((match = regex.exec(wwwAuthenticate)) !== null) {
            authDetails[match[1]] = match[2];
        }

        return authDetails;
    }

    private async makeAuthenticatedRequest(
        method: string,
        url: string,
        data?: any,
        isFormData = false
    ): Promise<any> {
        try {
            const isXml = typeof data === 'string' && data.trim().startsWith('<');
            const firstResponse = await this.httpClient.request({
                method: method as Method,
                url,
                data: isFormData ? data.getBuffer() : data,
                headers: isFormData
                    ? {
                          'Content-Type': `multipart/form-data; boundary=${data.getBoundary()}`,
                          Accept: '*/*',
                      }
                    : {
                          'Content-Type': isXml ? 'application/xml' : 'application/json',
                          Accept: isXml ? 'application/xml' : 'application/json',
                      },
                validateStatus: () => true,
            });

            if (firstResponse.status === 401 && firstResponse.headers['www-authenticate']) {
                const authHeader = this.generateDigestAuth(
                    method.toUpperCase(),
                    url,
                    firstResponse.headers['www-authenticate']
                );

                return await this.httpClient.request({
                    method: method as Method,
                    url,
                    data: isFormData ? data.getBuffer() : data,
                    headers: {
                        ...(isFormData
                            ? {
                                  'Content-Type': `multipart/form-data; boundary=${data.getBoundary()}`,
                                  Accept: '*/*',
                              }
                            : {
                                  'Content-Type': isXml ? 'application/xml' : 'application/json',
                                  Accept: isXml ? 'application/xml' : 'application/json',
                              }),
                        Authorization: authHeader,
                    },
                });
            }

            return firstResponse;
        } catch (error) {
            this.logger.error(`Authenticated request failed: ${error.message}`);
            throw error;
        }
    }

    async getDeviceInfo(config: HikvisionConfig): Promise<any> {
        try {
            // Avvalo configni o‘rnatamiz
            this.setConfig(config);

            const response = await this.makeAuthenticatedRequest(
                'GET',
                '/ISAPI/System/deviceInfo?format=json'
            );

            if (response.status !== 200) {
                this.logger.warn(`Device info: status ${response.status}`);
                return {
                    success: false,
                    message: `Kutilmagan status kodi: ${response.status}`,
                };
            }

            const rawData = response.data;
            const parser = new XMLParser({ ignoreAttributes: false });
            const parsed = typeof rawData === 'string' ? parser.parse(rawData) : rawData;
            const deviceInfo = parsed?.DeviceInfo || null;

            if (!deviceInfo) {
                return {
                    success: false,
                    message: 'Qurilma maʼlumotlari topilmadi',
                };
            }

            return {
                success: true,
                message: 'Qurilma maʼlumotlari muvaffaqiyatli olindi',
                data: deviceInfo,
            };
        } catch (error) {
            this.logger.error(`Device info olishda xatolik: ${error.message}`);
            return {
                success: false,
                message: `Device info olishda xatolik: ${error.message}`,
            };
        }
    }

    async getDeviceCapabilities(config: HikvisionConfig): Promise<any> {
        this.setConfig(config);

        const response = await this.makeAuthenticatedRequest('GET', '/ISAPI/System/capabilities');

        if (response.status !== 200) {
            this.logger.error(`Capabilities olishda xato: ${response.status}`);
            return null;
        }

        // XML → JSON
        const parser = new XMLParser();
        const json = parser.parse(response.data);
        return json;
    }

    async testConnection(config: HikvisionConfig): Promise<{ success: boolean; message: string }> {
        try {
            const result = await this.getDeviceInfo(config);

            if (result.success) {
                return {
                    success: true,
                    message: `✅ Hikvision qurilmasiga (${config.host}) ulanish muvaffaqiyatli`,
                };
            } else {
                return {
                    success: false,
                    message: `❌ Hikvision qurilmasi (${config.host}) bilan ulanishda xatolik`,
                };
            }
        } catch (error) {
            this.logger.error('Hikvision connection failed:', error.message);
            return {
                success: false,
                message: `Hikvision bilan ulanishda xatolik: ${error.message}`,
            };
        }
    }

    async createUser(dto: CreateHikvisionUserDto, config: HikvisionConfig): Promise<boolean> {
        try {
            this.setConfig(config);

            const userId = dto.employeeId;
            const checkExisting = await this.getUser(userId, config);
            if (checkExisting) {
                this.logger.log(`User ${userId} already exists in Hikvision`);
                return true;
            }

            const user = await this.employeeRepo.findById(+userId);

            if (!user) {
                throw new BadRequestException(`Employee with ID ${userId} not found`);
            }

            const resBody = {
                UserInfo: {
                    employeeNo: user.id.toString(),
                    name: user.name,
                    userType: 'normal',
                    doorRight: '1',
                    RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
                    Valid: {
                        enable: true,
                        timeType: 'local',
                        beginTime: '2025-11-03T00:00:00',
                        endTime: '2035-12-31T23:59:59', // 2030-12-31T23:59:59
                    },
                },
            };
            const response = await this.makeAuthenticatedRequest(
                'POST',
                `/ISAPI/AccessControl/UserInfo/Record?format=json`,
                resBody
            );
            if (response.status === 200) {
                this.logger.log(`User ${dto.employeeId} successfully created in Hikvision`);
                return response.data;
            }
            return false;
        } catch (error) {
            if (error.response) console.log(error.response.data);
            this.logger.error(`Failed to create user ${dto.employeeId}:`, error.message);
            throw new BadRequestException(`Hikvision da user yaratishda xatolik: ${error.message}`);
        }
    }

    async getUser(employeeNo: string, config: HikvisionConfig): Promise<HikvisionUser | null> {
        const users = await this.getAllUsers(config);
        const user = users.find(u => u.employeeNo === employeeNo);
        return user || null;
    }

    async getAllUsers(config:HikvisionConfig): Promise<HikvisionUser[]> {
        try {
            this.setConfig(config)

            const body = {
                UserInfoSearchCond: {
                    searchID: '1',
                    searchResultPosition: 0,
                    maxResults: parseInt(process.env.MAX_GET_USERS) || 5000,
                },
            };
            const response = await this.makeAuthenticatedRequest(
                'POST',
                '/ISAPI/AccessControl/UserInfo/search?format=json',
                body
            );

            if (response.status === 200 && response.data.UserInfoSearch?.UserInfo) {
                const users = Array.isArray(response.data.UserInfoSearch.UserInfo)
                    ? response.data.UserInfoSearch.UserInfo
                    : [response.data.UserInfoSearch.UserInfo];

                return users;
            }

            return [];
        } catch (error) {
            console.log(error);
            this.logger.error('Failed to get all users from Hikvision:', error.message);
            return [];
        }
    }

    async deleteUser(employeeNo: string, config?: HikvisionConfig): Promise<boolean> {
        this.setConfig(config);
        // this.setConfig({ host: '192.168.100.139', port: 80, protocol: 'http', username: 'admin', password: "!@#Mudofaa@" });

        const reqBody = {
            UserInfoDelCond: {
                EmployeeNoList: [
                    {
                        employeeNo: employeeNo,
                    },
                ],
            },
        };

        try {
            const response = await this.makeAuthenticatedRequest(
                'PUT',
                '/ISAPI/AccessControl/UserInfo/Delete?format=json',
                reqBody
            );

            if (response?.status === 200 || response?.status === 'OK') {
                this.logger.log(`User ${employeeNo} successfully deleted from Hikvision`);
                return true;
            }

            this.logger.warn(
                `Unexpected response while deleting user ${employeeNo} from Hikvision:`,
                response
            );
            return false;
        } catch (error) {
            this.logger.error(`Failed to delete user ${employeeNo} from Hikvision:`, error.message);
            throw new BadRequestException(
                `Hikvision dan user o'chirishda xatolik: ${error.message}`
            );
        }
    }

    async addCardToUser(employeeNo: string, cardNo: string): Promise<boolean> {
        try {
            const cardData = {
                CardInfo: {
                    employeeNo,
                    cardNo,
                    cardType: 'normalCard',
                },
            };

            const response = await this.makeAuthenticatedRequest(
                'POST',
                '/ISAPI/AccessControl/CardInfo/Record?format=json',
                cardData
            );

            if (response.status === 200) {
                this.logger.log(
                    `Card ${cardNo} successfully added to user ${employeeNo} in Hikvision`
                );
                return true;
            }

            return false;
        } catch (error) {
            this.logger.error(
                `Failed to add card to user ${employeeNo} in Hikvision:`,
                error.message
            );
            throw new BadRequestException(
                `Hikvision da karta qo'shishda xatolik: ${error.message}`
            );
        }
    }

    async addFaceToUserViaURL(
        employeeNo: string,
        faceURL: string,
        config: HikvisionConfig
    ): Promise<boolean> {
        try {
            this.setConfig(config);
            const formData = new FormData();
            formData.append(
                'FaceDataRecord',
                JSON.stringify({
                    faceLibType: 'blackFD',
                    FDID: '1',
                    FPID: employeeNo,
                    faceURL,
                })
            );

            const response = await this.makeAuthenticatedRequest(
                'PUT',
                '/ISAPI/Intelligent/FDLib/FDSetUp?format=json',
                formData,
                true // isFormData flag
            );

            if (response.status === 200) {
                this.logger.log(`Face URL successfully added to user ${employeeNo} in Hikvision`);
                return true;
            }

            this.logger.warn(`Unexpected status from Hikvision: ${response.status}`);
            return false;
        } catch (error) {
            if (error.response?.data) {
                console.error('Hikvision response error:', error.response.data);
            }

            this.logger.error(`Failed to add face via URL for ${employeeNo}:`, error.message);
            throw new BadRequestException(
                `Hikvision da yuz ma'lumotini yuklashda xatolik: ${error.message}`
            );
        }
    }

    async getAccessLogs(startTime?: string, endTime?: string): Promise<any[]> {
        try {
            const searchCondition = {
                AcsEventCond: {
                    searchID: '1',
                    searchResultPosition: 0,
                    maxResults: 200,
                    major: 0,
                    minor: 0,
                    startTime: '2025-11-04T00:00:00+05:00',
                    endTime: '2025-11-04T11:05:22+05:00',
                },
            };
            const response = await this.makeAuthenticatedRequest(
                'POST',
                '/ISAPI/AccessControl/AcsEvent?format=json',
                searchCondition
            );

            if (response.status === 200 && response.data.AcsEvent) {
                const events = response.data.AcsEvent.InfoList;
                console.log(response.data.AcsEvent);
                return events;
            }

            return [];
        } catch (error) {
            if (error.response) console.log(error.response);
            this.logger.error('Failed to get access logs from Hikvision:', error.message);
            return [];
        }
    }

    async toSimpleIso(dateStr: string): Promise<string> {
        const date = new Date(dateStr);
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
            date.getHours()
        )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    async configureEventListeningHost(
        config: HikvisionConfig,
        deviceId: number
    ): Promise<{
        success: boolean;
        message: string;
        data?: any;
    }> {
        try {
            this.setConfig(config);

            const serverHost = this.configService.hostIp;
            const serverPort = this.configService.port;

            const eventUrl = `http://${serverHost}:${serverPort}/api/v1/hikvision/event/${deviceId}`;
            this.logger.log(`Event URL: ${eventUrl}`);

            const jsonBody = {
                '@': { xmlns: 'http://www.isapi.org/ver20/XMLSchema', version: '2.0' },
                id: 1,
                url: eventUrl,
                protocolType: 'HTTP',
                parameterFormatType: 'JSON',
                addressingFormatType: 'ipaddress',
                host: serverHost,
                portNo: serverPort,
                ipAddress: serverHost,
                httpAuthenticationMethod: 'none',
                eventTypeList: {
                    eventType: ['FaceSnapshotEvent', 'FaceRecognitionEvent'],
                },
            };

            const xmlBody = this.xmlJsonService.jsonToXml(jsonBody, 'HttpHostNotification', {
                declaration: {
                    include: true,
                    encoding: 'UTF-8',
                    version: '1.0',
                },
                format: {
                    pretty: true,
                    indent: '  ',
                    newline: '\n',
                    doubleQuotes: true,
                },
            });

            const response = await this.makeAuthenticatedRequest(
                'PUT',
                '/ISAPI/Event/notification/httpHosts/1',
                xmlBody
            );

            if (response.status === 200) {
                const parser = new XMLParser();
                const result = parser.parse(response.data);

                this.logger.log('✅ Hikvision event listening host muvaffaqiyatli sozlandi');
                return {
                    success: true,
                    message: `Event host http://${serverHost}:${serverPort}/api/v1/hikvision/event/${deviceId} ga yo‘naltirildi`,
                    data: result,
                };
            }

            const err = response.data || 'Nomaʼlum xatolik';
            this.logger.warn(`⚠️ Event host sozlashda xato: ${response.status} → ${err}`);

            return {
                success: false,
                message: `Xato: ${response.status}. Javob: ${err}`,
            };
        } catch (error) {
            this.logger.error('❌ configureEventListeningHost:', error.message);
            return {
                success: false,
                message: `Event host sozlashda xatolik: ${error.message}`,
            };
        }
    }

    // async syncUsersFromDevice(): Promise<{ synced: number; errors: string[] }> {
    //   try {
    //     // const hikvisionUsers = await this.getAllUsers();
    //     let synced = 0;
    //     const errors: string[] = [];

    //     for (const hikvisionUser of hikvisionUsers) {
    //       try {
    //         // Convert Hikvision user to local format and save
    //         // This would require integration with UsersService
    //         synced++;
    //       } catch (error) {
    //         errors.push(
    //           `Error syncing user ${hikvisionUser.employeeNo}: ${error.message}`,
    //         );
    //       }
    //     }

    //     this.logger.log(`Synced ${synced} users from Hikvision device`);
    //     return { synced, errors };
    //   } catch (error) {
    //     this.logger.error('Failed to sync users from Hikvision:', error.message);
    //     throw new BadRequestException(
    //       `Hikvision dan userlarni sinxronlashda xatolik: ${error.message}`,
    //     );
    //   }
    // }
}
