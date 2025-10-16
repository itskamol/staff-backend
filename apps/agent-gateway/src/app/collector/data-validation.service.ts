import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class DataValidationService {
  private readonly logger = new Logger(DataValidationService.name);

  async validateMonitoringData(data: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields validation
    if (!data.agentId) {
      errors.push('agentId is required');
    }

    if (!data.organizationId) {
      errors.push('organizationId is required');
    }

    if (!data.receivedAt) {
      errors.push('receivedAt is required');
    }

    // Validate active windows if present
    if (data.activeWindows) {
      if (!Array.isArray(data.activeWindows)) {
        errors.push('activeWindows must be an array');
      } else {
        data.activeWindows.forEach((window, index) => {
          const windowErrors = this.validateActiveWindow(window, index);
          errors.push(...windowErrors);
        });
      }
    }

    // Validate visited sites if present
    if (data.visitedSites) {
      if (!Array.isArray(data.visitedSites)) {
        errors.push('visitedSites must be an array');
      } else {
        data.visitedSites.forEach((site, index) => {
          const siteErrors = this.validateVisitedSite(site, index);
          errors.push(...siteErrors);
        });
      }
    }

    // Validate screenshots if present
    if (data.screenshots) {
      if (!Array.isArray(data.screenshots)) {
        errors.push('screenshots must be an array');
      } else {
        data.screenshots.forEach((screenshot, index) => {
          const screenshotErrors = this.validateScreenshot(screenshot, index);
          errors.push(...screenshotErrors);
        });
      }
    }

    // Validate user sessions if present
    if (data.userSessions) {
      if (!Array.isArray(data.userSessions)) {
        errors.push('userSessions must be an array');
      } else {
        data.userSessions.forEach((session, index) => {
          const sessionErrors = this.validateUserSession(session, index);
          errors.push(...sessionErrors);
        });
      }
    }

    // Check if at least one data type is present
    if (!data.activeWindows && !data.visitedSites && !data.screenshots && !data.userSessions) {
      warnings.push('No monitoring data provided');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateDeviceEvent(event: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!event.agentId) {
      errors.push('agentId is required');
    }

    if (!event.organizationId) {
      errors.push('organizationId is required');
    }

    if (!event.deviceId) {
      errors.push('deviceId is required');
    }

    if (!event.eventType) {
      errors.push('eventType is required');
    }

    if (!event.timestamp) {
      errors.push('timestamp is required');
    } else {
      // Validate timestamp format
      const timestamp = new Date(event.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('timestamp must be a valid date');
      }
    }

    // Validate event data structure
    if (event.eventData && typeof event.eventData !== 'object') {
      errors.push('eventData must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateHeartbeat(heartbeat: any): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!heartbeat.agentId) {
      errors.push('agentId is required');
    }

    if (!heartbeat.organizationId) {
      errors.push('organizationId is required');
    }

    if (!heartbeat.status) {
      errors.push('status is required');
    } else {
      // Validate status values
      const validStatuses = ['online', 'offline', 'error', 'updating'];
      if (!validStatuses.includes(heartbeat.status.toLowerCase())) {
        errors.push(`status must be one of: ${validStatuses.join(', ')}`);
      }
    }

    if (!heartbeat.version) {
      errors.push('version is required');
    }

    if (!heartbeat.timestamp) {
      errors.push('timestamp is required');
    } else {
      // Validate timestamp format
      const timestamp = new Date(heartbeat.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('timestamp must be a valid date');
      }
    }

    // Validate system info if present
    if (heartbeat.systemInfo && typeof heartbeat.systemInfo !== 'object') {
      errors.push('systemInfo must be an object');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateActiveWindow(window: any, index: number): string[] {
    const errors: string[] = [];

    if (!window.computer_uid) {
      errors.push(`activeWindows[${index}]: computer_uid is required`);
    }

    if (!window.user_sid) {
      errors.push(`activeWindows[${index}]: user_sid is required`);
    }

    if (window.duration_seconds !== undefined && (typeof window.duration_seconds !== 'number' || window.duration_seconds < 0)) {
      errors.push(`activeWindows[${index}]: duration_seconds must be a non-negative number`);
    }

    if (window.window_title && typeof window.window_title !== 'string') {
      errors.push(`activeWindows[${index}]: window_title must be a string`);
    }

    if (window.process_name && typeof window.process_name !== 'string') {
      errors.push(`activeWindows[${index}]: process_name must be a string`);
    }

    if (window.url && typeof window.url !== 'string') {
      errors.push(`activeWindows[${index}]: url must be a string`);
    }

    return errors;
  }

  private validateVisitedSite(site: any, index: number): string[] {
    const errors: string[] = [];

    if (!site.computer_uid) {
      errors.push(`visitedSites[${index}]: computer_uid is required`);
    }

    if (!site.user_sid) {
      errors.push(`visitedSites[${index}]: user_sid is required`);
    }

    if (!site.url) {
      errors.push(`visitedSites[${index}]: url is required`);
    } else if (typeof site.url !== 'string') {
      errors.push(`visitedSites[${index}]: url must be a string`);
    }

    if (site.title && typeof site.title !== 'string') {
      errors.push(`visitedSites[${index}]: title must be a string`);
    }

    if (site.duration_seconds !== undefined && (typeof site.duration_seconds !== 'number' || site.duration_seconds < 0)) {
      errors.push(`visitedSites[${index}]: duration_seconds must be a non-negative number`);
    }

    return errors;
  }

  private validateScreenshot(screenshot: any, index: number): string[] {
    const errors: string[] = [];

    if (!screenshot.computer_uid) {
      errors.push(`screenshots[${index}]: computer_uid is required`);
    }

    if (!screenshot.user_sid) {
      errors.push(`screenshots[${index}]: user_sid is required`);
    }

    if (!screenshot.file_path) {
      errors.push(`screenshots[${index}]: file_path is required`);
    } else if (typeof screenshot.file_path !== 'string') {
      errors.push(`screenshots[${index}]: file_path must be a string`);
    }

    if (screenshot.file_size !== undefined && (typeof screenshot.file_size !== 'number' || screenshot.file_size < 0)) {
      errors.push(`screenshots[${index}]: file_size must be a non-negative number`);
    }

    return errors;
  }

  private validateUserSession(session: any, index: number): string[] {
    const errors: string[] = [];

    if (!session.computer_uid) {
      errors.push(`userSessions[${index}]: computer_uid is required`);
    }

    if (!session.user_sid) {
      errors.push(`userSessions[${index}]: user_sid is required`);
    }

    if (!session.session_type) {
      errors.push(`userSessions[${index}]: session_type is required`);
    } else {
      const validTypes = ['login', 'logout', 'lock', 'unlock', 'idle', 'active'];
      if (!validTypes.includes(session.session_type.toLowerCase())) {
        errors.push(`userSessions[${index}]: session_type must be one of: ${validTypes.join(', ')}`);
      }
    }

    if (session.metadata && typeof session.metadata !== 'object') {
      errors.push(`userSessions[${index}]: metadata must be an object`);
    }

    return errors;
  }
}