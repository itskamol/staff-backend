import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdapterConfiguration, LogLevel } from './interfaces/device-adapter.interface';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Joi from 'joi';

export interface ConfigurationSchema {
  adapterId: Joi.StringSchema;
  name: Joi.StringSchema;
  version: Joi.StringSchema;
  enabled: Joi.BooleanSchema;
  settings: Joi.ObjectSchema;
  connectionPoolSize?: Joi.NumberSchema;
  healthCheckInterval?: Joi.NumberSchema;
  logLevel?: Joi.StringSchema;
  metadata?: Joi.ObjectSchema;
}

export interface ConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class AdapterConfigurationService {
  private readonly logger = new Logger(AdapterConfigurationService.name);
  private readonly configPath: string;
  private readonly configurations = new Map<string, AdapterConfiguration>();
  private readonly schemas = new Map<string, Joi.ObjectSchema>();
  private readonly watchers = new Map<string, fs.FSWatcher>();

  constructor(private readonly config: ConfigService) {
    this.configPath = this.config.get('ADAPTER_CONFIG_PATH', './config/adapters');
  }

  /**
   * Load configuration for an adapter
   */
  async getConfiguration(adapterId: string): Promise<AdapterConfiguration | null> {
    // Check cache first
    if (this.configurations.has(adapterId)) {
      return this.configurations.get(adapterId)!;
    }

    try {
      const configFile = path.join(this.configPath, `${adapterId}.json`);
      const configData = await fs.readFile(configFile, 'utf-8');
      const config = JSON.parse(configData) as AdapterConfiguration;

      // Validate configuration
      const validation = await this.validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Cache configuration
      this.configurations.set(adapterId, config);

      // Set up file watcher for hot reload
      await this.setupConfigWatcher(adapterId, configFile);

      this.logger.debug(`Configuration loaded for adapter: ${adapterId}`);
      return config;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.debug(`No configuration file found for adapter: ${adapterId}`);
        return null;
      }
      
      this.logger.error(`Failed to load configuration for adapter ${adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save configuration for an adapter
   */
  async saveConfiguration(config: AdapterConfiguration): Promise<void> {
    try {
      // Validate configuration
      const validation = await this.validateConfiguration(config);
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Ensure config directory exists
      await fs.mkdir(this.configPath, { recursive: true });

      // Write configuration file
      const configFile = path.join(this.configPath, `${config.adapterId}.json`);
      await fs.writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8');

      // Update cache
      this.configurations.set(config.adapterId, config);

      // Set up file watcher if not already watching
      if (!this.watchers.has(config.adapterId)) {
        await this.setupConfigWatcher(config.adapterId, configFile);
      }

      this.logger.log(`Configuration saved for adapter: ${config.adapterId}`);
    } catch (error) {
      this.logger.error(`Failed to save configuration for adapter ${config.adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update configuration for an adapter
   */
  async updateConfiguration(adapterId: string, updates: Partial<AdapterConfiguration>): Promise<AdapterConfiguration> {
    const currentConfig = await this.getConfiguration(adapterId);
    if (!currentConfig) {
      throw new Error(`Configuration not found for adapter: ${adapterId}`);
    }

    const updatedConfig: AdapterConfiguration = {
      ...currentConfig,
      ...updates,
      adapterId, // Ensure ID doesn't change
    };

    await this.saveConfiguration(updatedConfig);
    return updatedConfig;
  }

  /**
   * Delete configuration for an adapter
   */
  async deleteConfiguration(adapterId: string): Promise<void> {
    try {
      const configFile = path.join(this.configPath, `${adapterId}.json`);
      await fs.unlink(configFile);

      // Remove from cache
      this.configurations.delete(adapterId);

      // Stop watching file
      const watcher = this.watchers.get(adapterId);
      if (watcher) {
        watcher.close();
        this.watchers.delete(adapterId);
      }

      this.logger.log(`Configuration deleted for adapter: ${adapterId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to delete configuration for adapter ${adapterId}: ${error.message}`);
        throw error;
      }
    }
  }

  /**
   * Get all configurations
   */
  async getAllConfigurations(): Promise<AdapterConfiguration[]> {
    try {
      await fs.mkdir(this.configPath, { recursive: true });
      const files = await fs.readdir(this.configPath);
      const configFiles = files.filter(file => file.endsWith('.json'));

      const configurations: AdapterConfiguration[] = [];
      
      for (const file of configFiles) {
        const adapterId = path.basename(file, '.json');
        try {
          const config = await this.getConfiguration(adapterId);
          if (config) {
            configurations.push(config);
          }
        } catch (error) {
          this.logger.warn(`Failed to load configuration from ${file}: ${error.message}`);
        }
      }

      return configurations;
    } catch (error) {
      this.logger.error(`Failed to load all configurations: ${error.message}`);
      return [];
    }
  }

  /**
   * Create default configuration for an adapter
   */
  createDefaultConfiguration(adapterId: string, name: string, version: string): AdapterConfiguration {
    return {
      adapterId,
      name,
      version,
      enabled: true,
      settings: {},
      connectionPoolSize: 10,
      healthCheckInterval: 30000, // 30 seconds
      logLevel: LogLevel.INFO,
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: 'system',
      },
    };
  }

  /**
   * Validate adapter configuration
   */
  async validateConfiguration(config: AdapterConfiguration): Promise<ConfigurationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get or create schema for this adapter
      const schema = this.getConfigurationSchema(config.adapterId);
      
      // Validate against schema
      const { error } = schema.validate(config, { abortEarly: false });
      
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      }

      // Additional business logic validation
      if (config.connectionPoolSize && config.connectionPoolSize < 1) {
        errors.push('Connection pool size must be at least 1');
      }

      if (config.connectionPoolSize && config.connectionPoolSize > 100) {
        warnings.push('Connection pool size is very high, consider reducing for better resource management');
      }

      if (config.healthCheckInterval && config.healthCheckInterval < 5000) {
        warnings.push('Health check interval is very low, may impact performance');
      }

      // Validate settings based on adapter type
      const settingsValidation = await this.validateAdapterSettings(config.adapterId, config.settings);
      errors.push(...settingsValidation.errors);
      warnings.push(...settingsValidation.warnings);

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Register configuration schema for an adapter
   */
  registerConfigurationSchema(adapterId: string, schema: Joi.ObjectSchema): void {
    this.schemas.set(adapterId, schema);
    this.logger.debug(`Configuration schema registered for adapter: ${adapterId}`);
  }

  /**
   * Get environment-specific configuration
   */
  getEnvironmentConfiguration(adapterId: string): Partial<AdapterConfiguration> {
    const envPrefix = `ADAPTER_${adapterId.toUpperCase().replace(/-/g, '_')}`;
    
    const envConfig: Partial<AdapterConfiguration> = {};

    // Check for environment overrides
    const enabled = this.config.get(`${envPrefix}_ENABLED`);
    if (enabled !== undefined) {
      envConfig.enabled = enabled === 'true';
    }

    const logLevel = this.config.get(`${envPrefix}_LOG_LEVEL`);
    if (logLevel && Object.values(LogLevel).includes(logLevel as LogLevel)) {
      envConfig.logLevel = logLevel as LogLevel;
    }

    const connectionPoolSize = this.config.get(`${envPrefix}_CONNECTION_POOL_SIZE`);
    if (connectionPoolSize) {
      const poolSize = parseInt(connectionPoolSize, 10);
      if (!isNaN(poolSize)) {
        envConfig.connectionPoolSize = poolSize;
      }
    }

    const healthCheckInterval = this.config.get(`${envPrefix}_HEALTH_CHECK_INTERVAL`);
    if (healthCheckInterval) {
      const interval = parseInt(healthCheckInterval, 10);
      if (!isNaN(interval)) {
        envConfig.healthCheckInterval = interval;
      }
    }

    return envConfig;
  }

  /**
   * Merge configuration with environment overrides
   */
  async getMergedConfiguration(adapterId: string): Promise<AdapterConfiguration | null> {
    const baseConfig = await this.getConfiguration(adapterId);
    if (!baseConfig) {
      return null;
    }

    const envConfig = this.getEnvironmentConfiguration(adapterId);
    
    return {
      ...baseConfig,
      ...envConfig,
      settings: {
        ...baseConfig.settings,
        // Environment settings would be merged here if needed
      },
      metadata: {
        ...baseConfig.metadata,
        lastModified: new Date().toISOString(),
        environmentOverrides: Object.keys(envConfig),
      },
    };
  }

  private getConfigurationSchema(adapterId: string): Joi.ObjectSchema {
    // Check if custom schema is registered
    if (this.schemas.has(adapterId)) {
      return this.schemas.get(adapterId)!;
    }

    // Return default schema
    return Joi.object({
      adapterId: Joi.string().required(),
      name: Joi.string().required(),
      version: Joi.string().pattern(/^\d+\.\d+\.\d+/).required(),
      enabled: Joi.boolean().required(),
      settings: Joi.object().required(),
      connectionPoolSize: Joi.number().integer().min(1).max(100).optional(),
      healthCheckInterval: Joi.number().integer().min(1000).optional(),
      logLevel: Joi.string().valid(...Object.values(LogLevel)).optional(),
      metadata: Joi.object().optional(),
    });
  }

  private async validateAdapterSettings(adapterId: string, settings: Record<string, any>): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Adapter-specific validation would go here
    // For now, just basic validation
    if (typeof settings !== 'object' || settings === null) {
      errors.push('Settings must be an object');
    }

    return { errors, warnings };
  }

  private async setupConfigWatcher(adapterId: string, configFile: string): Promise<void> {
    try {
      // Close existing watcher if any
      const existingWatcher = this.watchers.get(adapterId);
      if (existingWatcher) {
        existingWatcher.close();
      }

      // Create new watcher
      const watcher = await fs.watch(configFile);
      this.watchers.set(adapterId, watcher as any);

      // Handle file changes
      (async () => {
        try {
          for await (const event of watcher) {
            if (event.eventType === 'change') {
              this.logger.debug(`Configuration file changed for adapter: ${adapterId}`);
              
              // Reload configuration
              try {
                this.configurations.delete(adapterId); // Clear cache
                await this.getConfiguration(adapterId); // Reload
                
                this.logger.log(`Configuration reloaded for adapter: ${adapterId}`);
              } catch (error) {
                this.logger.error(`Failed to reload configuration for adapter ${adapterId}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          this.logger.error(`Configuration watcher error for adapter ${adapterId}: ${error.message}`);
        }
      })();

    } catch (error) {
      this.logger.warn(`Failed to setup configuration watcher for adapter ${adapterId}: ${error.message}`);
    }
  }
}