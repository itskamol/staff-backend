import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import FormData from 'form-data';
import { HikvisionCoreService } from '../core/hikvision.core.service';
import { ConfigService } from 'apps/dashboard-api/src/core/config/config.service';
import { EmployeeRepository } from '../../employee/repositories/employee.repository';
import { XmlJsonService } from 'apps/dashboard-api/src/shared/services/xtml-json.service';
import { CardDto, HikvisionConfig, HikvisionUser } from '../dto/create-hikvision-user.dto';
import { XMLParser } from 'fast-xml-parser';

@Injectable()
export class HikvisionAccessService {
    private readonly logger = new Logger(HikvisionAccessService.name);

    constructor(
        private readonly coreService: HikvisionCoreService,
        private configService: ConfigService,
        private readonly employeeRepo: EmployeeRepository,
        private readonly xmlJsonService: XmlJsonService
    ) {}

    async getDeviceInfo(config: HikvisionConfig): Promise<any> {
        try {
            this.coreService.setConfig(config);

            const response = await this.coreService.request('GET', '/ISAPI/System/deviceInfo');

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
        this.coreService.setConfig(config);

        const response = await this.coreService.request('GET', '/ISAPI/System/capabilities');

        if (response.status !== 200) {
            this.logger.error(`Capabilities olishda xato: ${response.status}`);
            return null;
        }

        // XML → JSON
        const parser = new XMLParser();
        const json = parser.parse(response.data);
        return json;
    }

    async createUser(employeeId: number, config: HikvisionConfig): Promise<boolean> {
        try {
            this.coreService.setConfig(config);

            const userId = employeeId;
            const checkExisting = await this.getUser(userId.toString(), config);
            if (checkExisting) {
                this.logger.log(`User ${userId} already exists in Hikvision`);
                return true;
            }

            const user = await this.employeeRepo.findById(+userId);

            if (!user) {
                throw new BadRequestException(`Employee with ID ${userId} not found`);
            }

            const now = new Date(); // hozirgi vaqt
            const tenYearsLater = new Date();
            tenYearsLater.setFullYear(now.getFullYear() + 10);

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
                        beginTime: now.toISOString().slice(0, 19),
                        endTime: tenYearsLater.toISOString().slice(0, 19),
                    },
                },
            };
            const response = await this.coreService.request(
                'POST',
                `/ISAPI/AccessControl/UserInfo/Record?format=json`,
                resBody
            );
            if (response.status === 200) {
                this.logger.log(`User ${employeeId} successfully created in Hikvision`);
                return response.data;
            }
            return false;
        } catch (error) {
            this.logger.error(`Failed to create user ${employeeId}:`, error.message);
            throw new BadRequestException(`Hikvision da user yaratishda xatolik: ${error.message}`);
        }
    }

    async getUser(employeeNo: string, config: HikvisionConfig): Promise<HikvisionUser | null> {
        const users = await this.getAllUsers(config);
        const user = users.find(u => u.employeeNo === employeeNo);
        return user || null;
    }

    async getAllUsers(config?: HikvisionConfig): Promise<HikvisionUser[]> {
        try {
            this.coreService.setConfig(config);

            const body = {
                UserInfoSearchCond: {
                    searchID: '1',
                    searchResultPosition: 0,
                    maxResults: parseInt(process.env.MAX_GET_USERS) || 5000,
                },
            };
            const response = await this.coreService.request(
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
            this.logger.error('Failed to get all users from Hikvision:', error.message);
            return [];
        }
    }

    async deleteUser(employeeNo: string, config?: HikvisionConfig): Promise<boolean> {
        this.coreService.setConfig(config);

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
            const response = await this.coreService.request(
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

    async addPasswordToUser(
        employeeNo: string,
        password: string,
        config: HikvisionConfig
    ): Promise<boolean> {
        try {
            this.coreService.setConfig(config);

            const reqBody = {
                UserInfo: {
                    employeeNo,
                    passWord: password,
                },
            };

            const response = await this.coreService.request(
                'PUT',
                '/ISAPI/AccessControl/UserInfo/Modify?format=json',
                reqBody
            );

            if (response.status === 200) {
                this.logger.log(`Password successfully added to user ${employeeNo}`);
                return true;
            }

            this.logger.warn(
                `Unexpected status while adding password to user ${employeeNo}: ${response.status}`
            );
            return false;
        } catch (error) {
            this.logger.error(`Error adding password to user ${employeeNo}: ${error.message}`);
            throw new BadRequestException(`Hikvision parol o'rnatishda xatolik: ${error.message}`);
        }
    }

    async addFaceToUserViaURL(
        employeeNo: string,
        url: string,
        config: HikvisionConfig
    ): Promise<boolean> {
        try {
            this.coreService.setConfig(config);
            const formData = new FormData();

            const port = this.configService.port;
            const ip = this.configService.hostIp;

            const photoUrl = `http://${ip}:${port}/api/storage/${url}`;

            formData.append(
                'FaceDataRecord',
                JSON.stringify({
                    faceLibType: 'blackFD',
                    FDID: '1',
                    FPID: employeeNo,
                    faceURL: photoUrl,
                })
            );

            const response = await this.coreService.request(
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

    async deleteFaceFromUser(employeeNo: string, config: HikvisionConfig): Promise<boolean> {
        try {
            this.coreService.setConfig(config);

            // Hikvision talabi bo'yicha body strukturasi
            const reqBody = {
                FPID: [
                    {
                        value: employeeNo,
                    },
                ],
            };

            // URL parametrlari muhim: FDID=1 (Asosiy kutubxona), faceLibType=blackFD
            const response = await this.coreService.request(
                'PUT',
                '/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=1&faceLibType=blackFD',
                reqBody
            );

            if (
                response.status === 200 &&
                (response.data?.statusCode === 1 || response.data?.statusString === 'OK')
            ) {
                this.logger.log(`Face data removed for user ${employeeNo}, but user kept active.`);
                return true;
            }

            // Ba'zi hollarda, agar yuz avvalroq o'chirilgan bo'lsa, xato berishi mumkin.
            // Buni "muvaffaqiyatli" deb hisoblash mumkin.
            this.logger.warn(`Hikvision delete face response: ${JSON.stringify(response.data)}`);
            return response.status === 200;
        } catch (error) {
            this.logger.error(`Failed to delete face for ${employeeNo}: ${error.message}`);
            // Agar rasm yo'q bo'lsa ham true qaytarishimiz mumkin (biznes logikaga qarab)
            return false;
        }
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
            this.coreService.setConfig(config);

            const serverHost = this.configService.hostIp;
            const serverPort = this.configService.port;

            const eventUrl = `http://${serverHost}:${serverPort}/api/v1/hikvision/event/${deviceId}`;
            this.logger.log(`Event URL: ${eventUrl}`, 'HikvisionService');

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

            const response = await this.coreService.request(
                'PUT',
                '/ISAPI/Event/notification/httpHosts/1',
                xmlBody
            );

            if (response.status === 200) {
                const parser = new XMLParser();
                const result = parser.parse(response.data);

                this.logger.log(
                    '✅ Hikvision event listening host muvaffaqiyatli sozlandi',
                    'HikvisionService'
                );
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

    async openDoor(doorNo: number = 1, config: HikvisionConfig): Promise<boolean> {
        try {
            this.coreService.setConfig(config);

            const xmlBody = this.xmlJsonService.jsonToXml(
                {
                    '@': {
                        version: '1.0',
                        xmlns: 'http://www.hikvision.com/ver10/XMLSchema',
                    },
                    cmd: 'open',
                },
                'RemoteControlDoor'
            );

            const response = await this.coreService.request(
                'PUT',
                `/ISAPI/AccessControl/RemoteControl/door/${doorNo}`,
                xmlBody
            );

            return response.status === 200;
        } catch (error) {
            this.logger.error(`Eshikni ochishda xatolik: ${doorNo}:`, error.message);
            throw new BadRequestException(`Eshikni ochishda xatolik: ${error.message}`);
        }
    }

    async addCardToUser(data: CardDto): Promise<boolean> {
        try {
            const { employeeNo, cardNo, config } = data;
            this.coreService.setConfig(config);

            const now = new Date(); // hozirgi vaqt
            const tenYearsLater = new Date();
            tenYearsLater.setFullYear(now.getFullYear() + 10);

            const reqBody = {
                CardInfo: {
                    employeeNo,
                    cardNo,
                    cardType: 'normalCard',
                    Valid: {
                        enable: true,
                        timeType: 'local',
                        beginTime: now.toISOString().slice(0, 19),
                        endTime: tenYearsLater.toISOString().slice(0, 19),
                    },
                },
            };

            const response = await this.coreService.request(
                'POST',
                '/ISAPI/AccessControl/CardInfo/Record?format=json',
                reqBody
            );

            if (response.status === 200) {
                this.logger.log(
                    `Card ${cardNo} successfully added to user ${employeeNo} in Hikvision`
                );
                return true;
            }

            this.logger.warn(
                `Unexpected status adding card to user ${employeeNo}: ${response.status}`
            );
            return false;
        } catch (error) {
            this.logger.error(`Failed to add card to user ${data.employeeNo}: ${error.message}`);
            throw new BadRequestException(
                `Hikvision da karta qo'shishda xatolik: ${error.message}`
            );
        }
    }

    async deleteCard(data: CardDto): Promise<boolean> {
        try {
            const { cardNo, config } = data; // employeeNo o'chirish uchun shart emas, karta raqami yetarli
            this.coreService.setConfig(config);

            const reqBody = {
                CardInfoDelCond: {
                    CardNoList: [
                        {
                            cardNo: cardNo,
                        },
                    ],
                },
            };

            // Hikvisionda o'chirish uchun DELETE metodi emas,
            // PUT metodi va Delete endpointi ishlatiladi
            const response = await this.coreService.request(
                'PUT',
                '/ISAPI/AccessControl/CardInfo/Delete?format=json',
                reqBody
            );

            if (response.status === 200) {
                this.logger.log(`Card ${cardNo} successfully deleted from Hikvision`);
                return true;
            }

            this.logger.warn(`Failed to delete card ${cardNo}: ${response.status}`);
            return false;
        } catch (error) {
            this.logger.error(`Error deleting card ${data.cardNo}: ${error.message}`);
            // Agar karta topilmasa ham success qaytarish kerak bo'lsa, shu yerni boshqarasiz
            throw new BadRequestException(
                `Hikvisiondan karta o'chirishda xatolik: ${error.message}`
            );
        }
    }

    async replaceCard(
        oldCardNo: string,
        newCardNo: string,
        employeeNo: string,
        config: HikvisionConfig
    ) {
        await this.deleteCard({
            employeeNo,
            cardNo: oldCardNo,
            config,
        });

        await this.addCardToUser({
            employeeNo,
            cardNo: newCardNo,
            config,
        });
    }
}
