import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDeviceAdapter, AdapterConfiguration, AdapterHealth } from './interfaces/device-adapter.interface';
import { AdapterConfigurationService } from './adapter-configuration.service';

export interface AdapterRegistration {
  adapter: IDeviceAdapter;
  configuration: AdapterConfiguration;
  registeredAt: Date;
  lastHealthCheck?: Date;
  health?: AdapterHealth;
  enabled: boolean;
  loadPath?: string;
  metadata: Record<string, any>;
}

export interface AdapterLoadResult {
  success: boolean;
  adapter?: IDeviceAdapter;
  error?: string;
  warnings?: string[];
}

@Injectable()
export class AdapterRegistryService implements OnModuleInit {
  private readonly logger = new Logger(AdapterRegistryService.name);
  private readonly adapters = new Map<string, AdapterRegistration>();
  private readonly adaptersByType = new Map<string, string[]>(); // deviceType -> adapterIds[]
  private readonly loadedModules = new Map<string, any>();

  constructor(
    private readonly config: ConfigService,
    private readonly adapterConfig: AdapterConfigurationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadConfiguredAdapters();
    this.logger.log('Adapter Registry initialized');
  }

  /**
   * Register an adapter instance
   */
  async registerAdapter(
    adapter: IDeviceAdapter,
    configuration?: AdapterConfiguration,
    loadPath?: string
  ): Promise<void> {
    try {
      // Validate adapter
      this.validateAdapter(adapter);

      // Get or create configuration
      const config = configuration || await this.adapterConfig.getConfiguration(adapter.id);
      if (!config) {
        throw new Error(`No configuration found for adapter ${adapter.id}`);
      }

      // Initialize adapter
      await adapter.initialize(config);

      // Create registration
      const registration: AdapterRegistration = {
        adapter,
        configuration: config,
        registeredAt: new Date(),
        enabled: config.enabled,
        loadPath,
        metadata: {
          supportedDevices: adapter.supportedDevices,
          capabilities: adapter.capabilities,
          version: adapter.version,
        },
      };

      // Register adapter
      this.adapters.set(adapter.id, registration);

      // Update device type mappings
      this.updateDeviceTypeMappings(adapter);

      // Perform initial health check
      await this.performHealthCheck(adapter.id);

      this.logger.log(`Adapter registered: ${adapter.id} v${adapter.version}`);
    } catch (error) {
      this.logger.error(`Failed to register adapter ${adapter.id}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Unregister an adapter
   */
  async unregisterAdapter(adapterId: string): Promise<void> {
    const registration = this.adapters.get(adapterId);
    if (!registration) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    try {
      // Shutdown adapter gracefully
      await registration.adapter.shutdown();

      // Remove from registry
      this.adapters.delete(adapterId);

      // Update device type mappings
      this.removeFromDeviceTypeMappings(registration.adapter);

      this.logger.log(`Adapter unregistered: ${adapterId}`);
    } catch (error) {
      this.logger.error(`Failed to unregister adapter ${adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load adapter from file system
   */
  async loadAdapter(adapterPath: string, configuration?: AdapterConfiguration): Promise<AdapterLoadResult> {
    try {
      this.logger.debug(`Loading adapter from: ${adapterPath}`);

      // Check if already loaded
      if (this.loadedModules.has(adapterPath)) {
        return {
          success: false,
          error: `Adapter already loaded from path: ${adapterPath}`,
        };
      }

      // Dynamic import
      const adapterModule = await import(adapterPath);
      
      // Find adapter class
      const AdapterClass = this.findAdapterClass(adapterModule);
      if (!AdapterClass) {
        return {
          success: false,
          error: `No adapter class found in module: ${adapterPath}`,
        };
      }

      // Create adapter instance
      const adapter = new AdapterClass();

      // Validate adapter implements interface
      this.validateAdapter(adapter);

      // Store loaded module
      this.loadedModules.set(adapterPath, adapterModule);

      // Register adapter
      await this.registerAdapter(adapter, configuration, adapterPath);

      return {
        success: true,
        adapter,
      };
    } catch (error) {
      this.logger.error(`Failed to load adapter from ${adapterPath}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Reload an adapter
   */
  async reloadAdapter(adapterId: string): Promise<AdapterLoadResult> {
    const registration = this.adapters.get(adapterId);
    if (!registration || !registration.loadPath) {
      return {
        success: false,
        error: `Cannot reload adapter ${adapterId}: no load path available`,
      };
    }

    try {
      // Unregister current adapter
      await this.unregisterAdapter(adapterId);

      // Clear module cache
      delete require.cache[require.resolve(registration.loadPath)];
      this.loadedModules.delete(registration.loadPath);

      // Reload adapter
      return await this.loadAdapter(registration.loadPath, registration.configuration);
    } catch (error) {
      this.logger.error(`Failed to reload adapter ${adapterId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get adapter by ID
   */
  getAdapter(adapterId: string): IDeviceAdapter | undefined {
    const registration = this.adapters.get(adapterId);
    return registration?.enabled ? registration.adapter : undefined;
  }

  /**
   * Get adapter registration
   */
  getAdapterRegistration(adapterId: string): AdapterRegistration | undefined {
    return this.adapters.get(adapterId);
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): AdapterRegistration[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get enabled adapters
   */
  getEnabledAdapters(): AdapterRegistration[] {
    return Array.from(this.adapters.values()).filter(reg => reg.enabled);
  }

  /**
   * Get adapters by device type
   */
  getAdaptersByDeviceType(deviceType: string): IDeviceAdapter[] {
    const adapterIds = this.adaptersByType.get(deviceType) || [];
    return adapterIds
      .map(id => this.getAdapter(id))
      .filter(adapter => adapter !== undefined) as IDeviceAdapter[];
  }

  /**
   * Find best adapter for device type
   */
  findBestAdapter(deviceType: string, requirements?: string[]): IDeviceAdapter | undefined {
    const adapters = this.getAdaptersByDeviceType(deviceType);
    
    if (adapters.length === 0) {
      return undefined;
    }

    if (adapters.length === 1) {
      return adapters[0];
    }

    // Score adapters based on requirements
    let bestAdapter = adapters[0];
    let bestScore = 0;

    for (const adapter of adapters) {
      let score = 0;
      
      // Base score for supporting the device type
      score += 10;
      
      // Additional score for meeting requirements
      if (requirements) {
        const supportedCommands = adapter.capabilities.supportedCommands;
        const metRequirements = requirements.filter(req => supportedCommands.includes(req));
        score += metRequirements.length * 5;
      }
      
      // Prefer newer versions
      const versionParts = adapter.version.split('.').map(Number);
      score += versionParts[0] * 100 + versionParts[1] * 10 + (versionParts[2] || 0);
      
      if (score > bestScore) {
        bestScore = score;
        bestAdapter = adapter;
      }
    }

    return bestAdapter;
  }

  /**
   * Enable/disable adapter
   */
  async setAdapterEnabled(adapterId: string, enabled: boolean): Promise<void> {
    const registration = this.adapters.get(adapterId);
    if (!registration) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    if (registration.enabled === enabled) {
      return; // No change needed
    }

    try {
      if (enabled) {
        // Re-initialize adapter
        await registration.adapter.initialize(registration.configuration);
        this.logger.log(`Adapter enabled: ${adapterId}`);
      } else {
        // Shutdown adapter
        await registration.adapter.shutdown();
        this.logger.log(`Adapter disabled: ${adapterId}`);
      }

      registration.enabled = enabled;
      
      // Update configuration
      await this.adapterConfig.updateConfiguration(adapterId, {
        ...registration.configuration,
        enabled,
      });

    } catch (error) {
      this.logger.error(`Failed to ${enabled ? 'enable' : 'disable'} adapter ${adapterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Perform health check on adapter
   */
  async performHealthCheck(adapterId: string): Promise<AdapterHealth> {
    const registration = this.adapters.get(adapterId);
    if (!registration) {
      throw new Error(`Adapter not found: ${adapterId}`);
    }

    try {
      const health = await registration.adapter.getHealth();
      
      registration.health = health;
      registration.lastHealthCheck = new Date();
      
      return health;
    } catch (error) {
      this.logger.error(`Health check failed for adapter ${adapterId}: ${error.message}`);
      
      const errorHealth: AdapterHealth = {
        status: 'critical' as any,
        connectedDevices: 0,
        totalConnections: 0,
        errorRate: 100,
        averageResponseTime: 0,
        lastHealthCheck: new Date(),
        issues: [{
          severity: 'critical' as any,
          message: `Health check failed: ${error.message}`,
          code: 'HEALTH_CHECK_FAILED',
          timestamp: new Date(),
        }],
        metrics: {
          connectionsPerSecond: 0,
          commandsPerSecond: 0,
          eventsPerSecond: 0,
          memoryUsage: 0,
          cpuUsage: 0,
          networkLatency: 0,
        },
      };
      
      registration.health = errorHealth;
      registration.lastHealthCheck = new Date();
      
      return errorHealth;
    }
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalAdapters: number;
    enabledAdapters: number;
    healthyAdapters: number;
    adaptersByStatus: Record<string, number>;
    deviceTypesCovered: number;
  } {
    const registrations = Array.from(this.adapters.values());
    
    const stats = {
      totalAdapters: registrations.length,
      enabledAdapters: registrations.filter(r => r.enabled).length,
      healthyAdapters: registrations.filter(r => r.health?.status === 'healthy').length,
      adaptersByStatus: {} as Record<string, number>,
      deviceTypesCovered: this.adaptersByType.size,
    };

    // Count by health status
    registrations.forEach(reg => {
      const status = reg.health?.status || 'unknown';
      stats.adaptersByStatus[status] = (stats.adaptersByStatus[status] || 0) + 1;
    });

    return stats;
  }

  private async loadConfiguredAdapters(): Promise<void> {
    try {
      const adapterConfigs = await this.adapterConfig.getAllConfigurations();
      
      for (const config of adapterConfigs) {
        if (config.enabled) {
          // Try to load adapter from configured path
          const adapterPath = this.config.get(`ADAPTER_${config.adapterId.toUpperCase()}_PATH`);
          if (adapterPath) {
            const result = await this.loadAdapter(adapterPath, config);
            if (!result.success) {
              this.logger.warn(`Failed to load configured adapter ${config.adapterId}: ${result.error}`);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to load configured adapters: ${error.message}`);
    }
  }

  private validateAdapter(adapter: any): void {
    const requiredMethods = [
      'connect', 'disconnect', 'getStatus', 'executeCommand',
      'fetchLogs', 'subscribe', 'unsubscribe', 'discoverDevices',
      'validateConfiguration', 'getHealth', 'initialize', 'shutdown'
    ];

    const requiredProperties = ['id', 'name', 'version', 'supportedDevices', 'capabilities'];

    // Check required properties
    for (const prop of requiredProperties) {
      if (!(prop in adapter)) {
        throw new Error(`Adapter missing required property: ${prop}`);
      }
    }

    // Check required methods
    for (const method of requiredMethods) {
      if (typeof adapter[method] !== 'function') {
        throw new Error(`Adapter missing required method: ${method}`);
      }
    }

    // Validate ID format
    if (!/^[a-z0-9-_]+$/.test(adapter.id)) {
      throw new Error(`Invalid adapter ID format: ${adapter.id}`);
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(adapter.version)) {
      throw new Error(`Invalid adapter version format: ${adapter.version}`);
    }
  }

  private findAdapterClass(module: any): any {
    // Look for exported class that implements IDeviceAdapter
    for (const exportName of Object.keys(module)) {
      const exportValue = module[exportName];
      
      if (typeof exportValue === 'function' && exportValue.prototype) {
        // Check if it looks like an adapter class
        const instance = Object.create(exportValue.prototype);
        if (instance && typeof instance.connect === 'function' && typeof instance.initialize === 'function') {
          return exportValue;
        }
      }
    }

    // Look for default export
    if (module.default && typeof module.default === 'function') {
      return module.default;
    }

    return null;
  }

  private updateDeviceTypeMappings(adapter: IDeviceAdapter): void {
    for (const deviceType of adapter.supportedDevices) {
      const adapters = this.adaptersByType.get(deviceType) || [];
      if (!adapters.includes(adapter.id)) {
        adapters.push(adapter.id);
        this.adaptersByType.set(deviceType, adapters);
      }
    }
  }

  private removeFromDeviceTypeMappings(adapter: IDeviceAdapter): void {
    for (const deviceType of adapter.supportedDevices) {
      const adapters = this.adaptersByType.get(deviceType) || [];
      const index = adapters.indexOf(adapter.id);
      if (index >= 0) {
        adapters.splice(index, 1);
        if (adapters.length === 0) {
          this.adaptersByType.delete(deviceType);
        } else {
          this.adaptersByType.set(deviceType, adapters);
        }
      }
    }
  }
}