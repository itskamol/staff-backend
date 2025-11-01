import { Injectable, Logger } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import axios, { type AxiosInstance, type AxiosResponse, type Method } from "axios"
import * as crypto from "crypto"

export interface DigestAuthConfig {
  host: string
  port: number
  username: string
  password: string
  protocol: "http" | "https"
}

@Injectable()
export class HikvisionAuthService {
  private readonly logger = new Logger(HikvisionAuthService.name)
  private httpClient: AxiosInstance
  private config: DigestAuthConfig

  constructor(private configService: ConfigService) {
    this.config = {
      host: this.configService.get("HIKVISION_HOST", "192.168.1.101"),
      port: this.configService.get("HIKVISION_PORT", 80),
      username: this.configService.get("HIKVISION_USERNAME", "admin"),
      password: this.configService.get("HIKVISION_PASSWORD", "admin123"),
      protocol: this.configService.get("HIKVISION_PROTOCOL", "http"),
    }

    this.httpClient = axios.create({
      baseURL: `${this.config.protocol}://${this.config.host}:${this.config.port}`,
      timeout: 30000,
      headers: {
        "Content-Type": "application/xml",
        Accept: "application/xml",
        "User-Agent": "NestJS-AccessControl/1.0",
      },
    })

    this.logger.log(`Hikvision ISAPI initialized: ${this.config.host}:${this.config.port}`)
  }

  // Parse WWW-Authenticate header
  private parseWWWAuthenticate(wwwAuthenticate: string): any {
    const authDetails: any = {}
    
    // Handle both Digest and Basic auth headers
    if (wwwAuthenticate.startsWith('Digest')) {
      const regex = /(\w+)="([^"]+)"/g
      let match
      
      while ((match = regex.exec(wwwAuthenticate)) !== null) {
        authDetails[match[1]] = match[2]
      }
      
      authDetails.type = 'digest'
    } else if (wwwAuthenticate.startsWith('Basic')) {
      authDetails.type = 'basic'
      authDetails.realm = 'Hikvision Device'
    }
    
    return authDetails
  }

  // Generate digest authentication header
  private generateDigestAuth(method: string, uri: string, authDetails: any): string {
    const ha1 = crypto
      .createHash('md5')
      .update(`${this.config.username}:${authDetails.realm}:${this.config.password}`)
      .digest('hex')
    
    const ha2 = crypto
      .createHash('md5')
      .update(`${method}:${uri}`)
      .digest('hex')
    
    const response = crypto
      .createHash('md5')
      .update(`${ha1}:${authDetails.nonce}:${ha2}`)
      .digest('hex')
    
    return `Digest username="${this.config.username}", realm="${authDetails.realm}", nonce="${authDetails.nonce}", uri="${uri}", response="${response}"`
  }

  // Generate basic authentication header
  private generateBasicAuth(): string {
    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64')
    return `Basic ${credentials}`
  }

  // Make authenticated request with automatic auth handling
  async makeAuthenticatedRequest(method: string, url: string, data?: any){
    try {
      this.logger.debug(`Making ${method} request to ${url}`)
      
      // First try without authentication
      let response = await this.httpClient.request({
        method: method as Method,
        url,
        data,
        validateStatus: () => true, // Don't throw on 401
      })
      
      // If unauthorized, handle authentication
      if (response.status === 401 && response.headers['www-authenticate']) {
        this.logger.debug('Received 401, attempting authentication')
        
        const authDetails = this.parseWWWAuthenticate(response.headers['www-authenticate'])
        let authHeader: string
        
        if (authDetails.type === 'digest') {
          authHeader = this.generateDigestAuth(method.toUpperCase(), url, authDetails)
          this.logger.debug('Using Digest authentication')
        } else {
          authHeader = this.generateBasicAuth()
          this.logger.debug('Using Basic authentication')
        }
        
        // Retry with authentication
        response =  await this.httpClient.request({
          method:method as Method,
          url,
          data,
          headers: {
            "Content-Type": "application/xml",
            Accept: "application/xml",
            Authorization: authHeader,
          },
        })
      }
      
      if (response.status >= 400) {
        this.logger.error(`Request failed with status ${response.status}: ${response.statusText}`)
        this.logger.error(`Response data: ${JSON.stringify(response.data)}`)
      }
      
      return response
    } catch (error) {
      this.logger.error(`Authenticated request failed: ${error.message}`)
      if (error.response) {
        this.logger.error(`Response status: ${error.response.status}`)
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`)
      }
      throw error
    }
  }

  // Test connection with detailed logging
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      this.logger.log('Testing Hikvision connection...')
      
      const response = await this.makeAuthenticatedRequest('GET', '/ISAPI/System/deviceInfo')
      
      if (response.status === 200) {
        this.logger.log('Hikvision connection successful')
        return {
          success: true,
          message: 'Connection successful',
          details: {
            status: response.status,
            contentType: response.headers['content-type'],
          }
        }
      } else {
        this.logger.warn(`Hikvision connection returned status ${response.status}`)
        return {
          success: false,
          message: `Connection failed with status ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
          }
        }
      }
    } catch (error) {
      this.logger.error('Hikvision connection failed:', error.message)
      return {
        success: false,
        message: `Connection error: ${error.message}`,
        details: {
          error: error.message,
          code: error.code,
        }
      }
    }
  }

  // Get configuration for debugging
  getConfig(): Partial<DigestAuthConfig> {
    return {
      host: this.config.host,
      port: this.config.port,
      username: this.config.username,
      protocol: this.config.protocol,
      // Don't return password for security
    }
  }

  
}
