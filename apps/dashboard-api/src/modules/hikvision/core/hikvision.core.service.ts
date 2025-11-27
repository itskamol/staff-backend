import { Injectable, Logger } from '@nestjs/common';
import axios, { Method, type AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { HikvisionConfig } from '../dto/create-hikvision-user.dto';
import { EncryptionService } from 'apps/dashboard-api/src/shared/services/encryption.service';

@Injectable()
export class HikvisionCoreService {
    private readonly logger = new Logger(HikvisionCoreService.name);
    private httpClient: AxiosInstance;
    private config: HikvisionConfig;

    constructor(private readonly ecryptionService: EncryptionService) {
        this.logger.log(`HikvisionCoreService initialized`);
    }

    /**
     * Har bir so'rovdan oldin config yangilanadi
     */
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

    getConfig(): HikvisionConfig {
        return this.config;
    }

    /**
     * Digest Auth bilan so'rov yuborish
     */
    async request(method: string, url: string, data?: any, isFormData = false): Promise<any> {
        if (!this.httpClient) {
            throw new Error('Configuration not set. Call setConfig() first.');
        }

        try {
            const isXml = typeof data === 'string' && data.trim().startsWith('<');
            const headers: any = isFormData
                ? {
                      'Content-Type': `multipart/form-data; boundary=${data.getBoundary()}`,
                      Accept: '*/*',
                  }
                : {
                      'Content-Type': isXml ? 'application/xml' : 'application/json',
                      Accept: isXml ? 'application/xml' : 'application/json',
                  };

            const firstResponse = await this.httpClient.request({
                method: method as Method,
                url,
                data: isFormData ? data.getBuffer() : data,
                headers,
                validateStatus: () => true, // Xatolik bo'lsa ham ushlab qolamiz
            });

            // 401 bo'lsa, Digest Auth header generatsiya qilamiz
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
                        ...headers,
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
}
