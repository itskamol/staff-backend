import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import FormData from 'form-data';
import { HikvisionCoreService } from '../core/hikvision.core.service';
import { ConfigService } from 'apps/dashboard-api/src/core/config/config.service';
import { EmployeeRepository } from '../../employee/repositories/employee.repository';
import { XmlJsonService } from 'apps/dashboard-api/src/shared/services/xtml-json.service';
import {
    CardDto,
    DeviceAuthDto,
    DeviceTimeDto,
    HikvisionConfig,
    HikvisionUser,
    ResultDeviceDisplayDto,
} from '../dto/create-hikvision-user.dto';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '@app/shared/database';
import {
    mapAuthModeToHikvision,
    mapHikvisionVerifyModeToAuthMode,
} from '../dto/hikvision-auth.mapper';
import { AuthMode } from '@prisma/client';

@Injectable()
export class HikvisionAccessService {
    private readonly logger = new Logger(HikvisionAccessService.name);

    constructor(
        private readonly coreService: HikvisionCoreService,
        private configService: ConfigService,
        private readonly prisma: PrismaService,
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
        const [acsCfg, weekPlan, time] = await Promise.all([
            this.getAcsCfg(config),
            this.getVerifyWeekPlanCfg(config),
            this.getSystemTime(config),
        ]);

        // authMode chiqarish (Monday verifyMode)
        let authMode: AuthMode | null = null;
        try {
            const list = weekPlan?.WeekPlanCfg ?? [];
            const monday = Array.isArray(list) ? list.find(x => x.week === 'Monday') : null;
            authMode = mapHikvisionVerifyModeToAuthMode(monday?.verifyMode);
        } catch {}

        // display settings
        const display = acsCfg
            ? {
                  showName: Boolean(acsCfg.showName),
                  showPicture: Boolean(acsCfg.showPicture),
                  showEmployeeNo: Boolean(acsCfg.showEmployeeNo),
                  voicePrompt: Boolean(acsCfg.voicePrompt),
                  desensitiseName: Boolean(acsCfg.desensitiseName),
                  desensitiseEmployeeNo: Boolean(acsCfg.desensitiseEmployeeNo),
              }
            : {};

        // time info (edit uchun)
        const timeInfo = time
            ? {
                  timeMode: time.timeMode,
                  localTime: time.localTime,
                  timeZone: time.timeZone,
              }
            : {};

        // yakuniy capabilities
        return {
            ...(authMode ? { authMode } : {}),
            ...display,
            ...timeInfo,
        };
    }

    private async getAcsCfg(config: HikvisionConfig): Promise<any | null> {
        this.coreService.setConfig(config);
        const res = await this.coreService.request(
            'GET',
            '/ISAPI/AccessControl/AcsCfg?format=json'
        );
        if (res.status !== 200) return null;
        return res.data?.AcsCfg ?? res.data;
    }

    private async getVerifyWeekPlanCfg(config: HikvisionConfig): Promise<any | null> {
        this.coreService.setConfig(config);
        const res = await this.coreService.request(
            'GET',
            '/ISAPI/AccessControl/VerifyWeekPlanCfg/1?format=json'
        );
        if (res.status !== 200) return null;
        return res.data?.VerifyWeekPlanCfg ?? res.data;
    }

    private async getSystemTime(config: HikvisionConfig): Promise<any | null> {
        this.coreService.setConfig(config);
        const res = await this.coreService.request('GET', '/ISAPI/System/time');
        if (res.status !== 200) return null;

        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(res.data);
        return parsed?.Time ?? null;
    }

    async createUser(
        employeeId: number,
        config: HikvisionConfig,
        isVisitor: boolean = false
    ): Promise<boolean> {
        try {
            this.coreService.setConfig(config);

            const userId = isVisitor ? `v${employeeId}` : employeeId.toString();
            const checkExisting = await this.getUser(userId.toString(), config);
            if (checkExisting) {
                this.logger.log(`User ${userId} already exists in Hikvision`);
                return true;
            }

            let user: any;
            if (!isVisitor) {
                user = await this.employeeRepo.findById(+userId);
                if (!user) {
                    throw new BadRequestException(`Employee with ID ${userId} not found`);
                }
            }

            if (isVisitor) {
                user = await this.prisma.visitor.findFirst({ where: { id: employeeId } });
                if (!user) {
                    throw new BadRequestException(`Visitor with ID ${employeeId} not found`);
                }
            }

            const now = new Date(); // hozirgi vaqt
            const tenYearsLater = new Date();
            tenYearsLater.setFullYear(now.getFullYear() + 10);
            const resBody = {
                UserInfo: {
                    employeeNo: isVisitor ? `v${user.id}` : user.id.toString(),
                    name: user.name || user.firstName + ' ' + (user.lastName || ''),
                    userType: isVisitor ? 'visitor' : 'normal',
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
                this.logger.log(
                    `User ${
                        isVisitor ? `v${employeeId}` : employeeId
                    } successfully created in Hikvision`
                );
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
                    maxResults: 5000,
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
                        employeeNo,
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
        passWord: string,
        config: HikvisionConfig,
        startDate: Date = new Date(),
        endDate: Date = new Date(new Date().setFullYear(new Date().getFullYear() + 10))
    ): Promise<boolean> {
        try {
            this.coreService.setConfig(config);

            const beginTimeFormatted = await this.formatDate(startDate);
            const endTimeFormatted = await this.formatDate(endDate);

            const reqBody = {
                UserInfo: {
                    employeeNo,
                    passWord,
                    Valid: {
                        enable: true,
                        beginTime: beginTimeFormatted, // Karta amal qilishni boshlash vaqti
                        endTime: endTimeFormatted, // Karta amal qilishni tugatish vaqti
                        timeType: 'local',
                    },
                },
            };

            const response = await this.coreService.request(
                'PUT',
                '/ISAPI/AccessControl/UserInfo/Modify?format=json',
                reqBody
            );

            if (response.status === 200 && passWord === '') {
                this.logger.log(`Password successfully deleted to user ${employeeNo}`);
                return true;
            }
            if (response.status === 200) {
                this.logger.log(`Password successfully added to user ${employeeNo}`);
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

    async formatDate(date: Date): Promise<string> {
        // 5 soat = 5 * 60 * 60 * 1000 millisekund
        const uzbekistanTime = new Date(date.getTime() + 5 * 60 * 60 * 1000);

        // ISO formatga o'tkazamiz va Hikvision tushunadigan ko'rinishga keltiramiz
        return uzbekistanTime.toISOString().slice(0, 19);
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
            const {
                employeeNo,
                cardNo,
                config,
                beginTime = new Date(),
                endTime = new Date(new Date().setFullYear(new Date().getFullYear() + 10)),
            } = data;
            this.coreService.setConfig(config);

            const beginTimeFormatted = await this.formatDate(beginTime);
            const endTimeFormatted = await this.formatDate(endTime);

            const reqBody = {
                CardInfo: {
                    employeeNo,
                    cardNo: cardNo,
                    cardType: 'normalCard',
                    Valid: {
                        enable: true,
                        timeType: 'local',
                        beginTime: beginTimeFormatted,
                        endTime: endTimeFormatted,
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

    async setDeviceAuthMode(data: DeviceAuthDto): Promise<boolean> {
        const { config, authMode } = data;
        this.coreService.setConfig(config);

        const hikvisionMode = mapAuthModeToHikvision(authMode);

        const weekPlan = [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
        ].map((day, index) => ({
            id: index + 1,
            week: day,
            enable: true,
            verifyMode: hikvisionMode,
            TimeSegment: {
                beginTime: '00:00:00',
                endTime: '24:00:00',
            },
        }));

        const body = {
            VerifyWeekPlanCfg: {
                enable: true,
                WeekPlanCfg: weekPlan,
            },
        };

        const response = await this.coreService.request(
            'PUT',
            '/ISAPI/AccessControl/VerifyWeekPlanCfg/1?format=json',
            body
        );

        if (response.status === 200) {
            this.logger.log(`✅ Device auth mode set to ${hikvisionMode}`);
            return true;
        }

        this.logger.warn(`⚠️ Failed to set auth mode: ${response.status}`);
        return false;
    }

    async setDisplayAuthResult(data: ResultDeviceDisplayDto) {
        const { config } = data;
        this.coreService.setConfig(config);
        const body = {
            AcsCfg: {
                showPicture: data.showPicture,
                showName: data.showName,
                showEmployeeNo: data.showEmployeeNo,
                voicePrompt: data.voicePrompt,
                desensitiseName: data.desensitiseName,
                desensitiseEmployeeNo: data.desensitiseEmployeeNo,
                saveCapPic: true,
                saveFacePic: true,
                saveVerificationPic: true,
                uploadCapPic: true,
                uploadVerificationPic: true,
            },
        };

        const response = await this.coreService.request(
            'PUT',
            '/ISAPI/AccessControl/AcsCfg?format=json',
            body
        );

        if (response.status === 200) {
            this.logger.log(`✅ Device display result settings changes`);
            return true;
        }

        return response.status === 200;
    }

    async setDeviceTime(data: DeviceTimeDto): Promise<boolean> {
        const { config, localTime } = data;
        this.coreService.setConfig(config);

        const jsonBody: any = {
            '@': { xmlns: 'http://www.isapi.org/ver20/XMLSchema', version: '2.0' },
            timeMode: 'manual',
            timeZone: 'CST-5:00:00',
            localTime: localTime,
        };

        const xmlBody = this.xmlJsonService.jsonToXml(jsonBody, 'Time', {
            declaration: { include: true, encoding: 'UTF-8', version: '1.0' },
            format: { pretty: true, indent: '  ', newline: '\n', doubleQuotes: true },
        });

        const response = await this.coreService.request('PUT', '/ISAPI/System/time', xmlBody);
        if (response.status === 200) {
            this.logger.log(`✅ Device auth mode set to  ${localTime}`);
            return true;
        }
        return response.status === 200;
    }

    async getDeviceTime(config: HikvisionConfig): Promise<{
        timeMode: 'manual' | 'ntp';
        localTime: string;
        timeZone: string;
    }> {
        this.coreService.setConfig(config);

        const response = await this.coreService.request('GET', '/ISAPI/System/time');

        if (response.status !== 200) {
            throw new BadRequestException('Failed to get device time');
        }

        const parser = new XMLParser({ ignoreAttributes: false });
        const parsed = parser.parse(response.data);

        const time = parsed?.Time;
        if (!time) {
            throw new BadRequestException('Invalid time response from device');
        }

        return {
            timeMode: time.timeMode,
            localTime: time.localTime,
            timeZone: time.timeZone,
        };
    }
}
