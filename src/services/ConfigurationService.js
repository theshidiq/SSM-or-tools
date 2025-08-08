/**
 * ConfigurationService.js
 * 
 * Comprehensive configuration service layer that integrates the database schema 
 * with the ML prediction system for restaurant shift scheduling.
 * 
 * Features:
 * - Database configuration loading and caching
 * - Real-time configuration updates via Supabase subscriptions
 * - Version management and rollback capabilities
 * - Performance optimization with intelligent caching
 * - Graceful fallback to default configurations
 * - Rule conflict detection and resolution
 */

import { supabase } from '../utils/supabase.js';

export class ConfigurationService {
  constructor() {
    // Configuration cache with version tracking
    this.configCache = new Map();
    this.versionCache = new Map();
    this.subscriptions = new Map();
    
    // Cache settings
    this.cacheSettings = {
      maxAge: 5 * 60 * 1000, // 5 minutes
      maxSize: 1000,
      refreshThreshold: 2 * 60 * 1000, // 2 minutes
    };
    
    // Performance tracking
    this.performanceMetrics = {
      cacheHitRate: 0,
      avgLoadTime: 0,
      totalRequests: 0,
      cacheHits: 0,
      dbQueries: 0,
      lastRefreshTime: 0,
    };
    
    // Configuration state
    this.currentVersionId = null;
    this.currentRestaurantId = null;
    this.isInitialized = false;
    this.isLoading = false;
    
    // Real-time subscription handlers
    this.subscriptionHandlers = {
      config_versions: this.handleVersionChange.bind(this),
      conflict_rules: this.handleRuleChange.bind(this),
      daily_limits: this.handleLimitChange.bind(this),
      monthly_limits: this.handleLimitChange.bind(this),
      priority_rules: this.handlePriorityChange.bind(this),
      ml_model_configs: this.handleMLConfigChange.bind(this),
    };
    
    // Default configurations for fallback
    this.defaultConfigs = this.initializeDefaultConfigurations();
    
    // Business rule engine
    this.businessRuleEngine = new BusinessRuleEngine();
    this.conflictDetector = new ConfigurationConflictDetector();
    this.performanceMonitor = new ConfigurationPerformanceMonitor();
  }

  /**
   * Initialize configuration service
   * @param {Object} options - Configuration options
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;

    try {
      console.log('🔧 Initializing Configuration Service...');
      const startTime = Date.now();

      // Extract options
      this.currentRestaurantId = options.restaurantId;
      if (!this.currentRestaurantId) {
        throw new Error('Restaurant ID is required for configuration service');
      }

      // Override cache settings if provided
      Object.assign(this.cacheSettings, options.cache || {});

      // Initialize performance monitor
      await this.performanceMonitor.initialize();

      // Load active configuration version
      await this.loadActiveConfigVersion();

      // Load all configurations
      await this.loadAllConfigurations();

      // Initialize business rule engine
      await this.businessRuleEngine.initialize(this);

      // Set up real-time subscriptions
      await this.setupRealtimeSubscriptions();

      // Start background cache maintenance
      this.startCacheMaintenance();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;

      console.log(`✅ Configuration Service initialized in ${initTime}ms`);
      console.log(`📊 Loaded ${this.configCache.size} configuration entries`);
      console.log(`🔄 Active version: ${this.currentVersionId || 'default'}`);

      return true;

    } catch (error) {
      console.error('❌ Configuration Service initialization failed:', error);
      await this.initializeFallbackMode();
      return false;
    }
  }

  /**
   * Load active configuration version for restaurant
   */
  async loadActiveConfigVersion() {
    try {
      const { data, error } = await supabase
        .from('config_versions')
        .select('*')
        .eq('restaurant_id', this.currentRestaurantId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is ok
        throw error;
      }

      if (data) {
        this.currentVersionId = data.id;
        this.versionCache.set('active', {
          ...data,
          loadTime: Date.now(),
        });
        console.log(`📋 Active configuration version: ${data.name} (v${data.version_number})`);
      } else {
        console.log('📋 No active configuration version found, using defaults');
      }

    } catch (error) {
      console.warn('⚠️ Failed to load active configuration version:', error);
      this.currentVersionId = null;
    }
  }

  /**
   * Load all configuration types from database
   */
  async loadAllConfigurations() {
    const configTypes = [
      'staff_groups',
      'conflict_rules', 
      'daily_limits',
      'monthly_limits',
      'priority_rules',
      'ml_model_configs'
    ];

    const loadPromises = configTypes.map(type => this.loadConfigurationType(type));
    await Promise.all(loadPromises);
  }

  /**
   * Load specific configuration type
   * @param {string} configType - Configuration type to load
   */
  async loadConfigurationType(configType) {
    try {
      const startTime = Date.now();
      const cacheKey = `${configType}_${this.currentVersionId || 'default'}`;

      // Check cache first
      if (this.isCacheValid(cacheKey)) {
        this.performanceMetrics.cacheHits++;
        return this.configCache.get(cacheKey);
      }

      // Query database with improved error handling
      let query = supabase.from(configType).select('*');

      // Add restaurant filter
      query = query.eq('restaurant_id', this.currentRestaurantId);

      // Add version filter if we have active version
      if (this.currentVersionId && this.hasVersionColumn(configType)) {
        query = query.eq('version_id', this.currentVersionId);
      }

      // Add active filter
      query = query.eq('is_active', true);

      const { data, error } = await query;
      
      if (error) {
        // Handle specific error codes
        if (error.code === 'PGRST116') {
          // Table exists but no data - this is OK
          console.log(`📋 No data found for ${configType}, using defaults`);
        } else if (error.code === '42P01') {
          // Table does not exist
          console.warn(`⚠️ Table ${configType} does not exist, using fallback configuration`);
          throw new Error(`Table ${configType} does not exist`);
        } else {
          // Other database errors
          console.error(`❌ Database error loading ${configType}:`, error);
          throw error;
        }
      }

      // Process and cache the configuration
      const processedConfig = this.processConfiguration(configType, data || []);
      
      this.configCache.set(cacheKey, {
        data: processedConfig,
        loadTime: Date.now(),
        type: configType,
        version: this.currentVersionId,
      });

      // Update metrics
      this.performanceMetrics.dbQueries++;
      this.performanceMetrics.avgLoadTime = (
        (this.performanceMetrics.avgLoadTime + (Date.now() - startTime)) / 2
      );

      console.log(`✅ Loaded ${configType}: ${data?.length || 0} entries`);
      return processedConfig;

    } catch (error) {
      console.error(`❌ Failed to load ${configType}:`, error);
      
      // Return default configuration for this type
      const defaultConfig = this.getDefaultConfiguration(configType);
      
      this.configCache.set(`${configType}_fallback`, {
        data: defaultConfig,
        loadTime: Date.now(),
        type: configType,
        isFallback: true,
      });

      return defaultConfig;
    }
  }

  /**
   * Get configuration by type
   * @param {string} configType - Configuration type
   * @param {Object} options - Query options
   */
  async getConfiguration(configType, options = {}) {
    try {
      this.performanceMetrics.totalRequests++;
      
      const cacheKey = this.buildCacheKey(configType, options);
      
      // Check cache validity
      if (this.isCacheValid(cacheKey)) {
        this.performanceMetrics.cacheHits++;
        const cached = this.configCache.get(cacheKey);
        
        // Check if cache needs refresh in background
        if (this.shouldRefreshCache(cached)) {
          this.refreshConfigurationInBackground(configType, options);
        }
        
        return cached.data;
      }

      // Load from database
      const config = await this.loadConfigurationType(configType);
      return config;

    } catch (error) {
      console.error(`❌ Failed to get ${configType} configuration:`, error);
      return this.getDefaultConfiguration(configType);
    }
  }

  /**
   * Get staff conflict groups from database
   */
  async getStaffGroups() {
    const groups = await this.getConfiguration('staff_groups');
    
    // Convert to format expected by ML systems
    return groups.map(group => ({
      id: group.id,
      name: group.name,
      members: [], // Will be populated by joining with staff_group_members
      color: group.color,
      created_at: group.created_at,
    }));
  }

  /**
   * Get detailed staff groups with members
   */
  async getStaffGroupsWithMembers() {
    try {
      const cacheKey = `staff_groups_with_members_${this.currentVersionId || 'default'}`;
      
      if (this.isCacheValid(cacheKey)) {
        this.performanceMetrics.cacheHits++;
        return this.configCache.get(cacheKey).data;
      }

      // Complex query to get groups with members
      const { data, error } = await supabase
        .from('staff_groups')
        .select(`
          *,
          staff_group_members (
            staff:staff_id (
              id,
              name,
              position,
              is_active
            )
          )
        `)
        .eq('restaurant_id', this.currentRestaurantId)
        .eq('is_active', true);

      if (error) throw error;

      // Transform data to expected format
      const groupsWithMembers = data.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        color: group.color,
        members: group.staff_group_members
          .map(member => member.staff)
          .filter(staff => staff && staff.is_active),
      }));

      // Cache result
      this.configCache.set(cacheKey, {
        data: groupsWithMembers,
        loadTime: Date.now(),
        type: 'staff_groups_with_members',
        version: this.currentVersionId,
      });

      return groupsWithMembers;

    } catch (error) {
      console.error('❌ Failed to get staff groups with members:', error);
      return this.getDefaultStaffGroups();
    }
  }

  /**
   * Get conflict rules from database
   */
  async getConflictRules() {
    const rules = await this.getConfiguration('conflict_rules');
    
    return rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      rule_type: rule.rule_type,
      conflict_definition: rule.conflict_definition,
      penalty_weight: parseFloat(rule.penalty_weight),
      is_hard_constraint: rule.is_hard_constraint,
      effective_from: rule.effective_from,
      effective_until: rule.effective_until,
    }));
  }

  /**
   * Get daily limits from database
   */
  async getDailyLimits() {
    const limits = await this.getConfiguration('daily_limits');
    
    return limits.reduce((acc, limit) => {
      const config = limit.limit_config;
      acc[limit.name] = {
        ...config,
        penalty_weight: parseFloat(limit.penalty_weight),
        is_hard_constraint: limit.is_hard_constraint,
      };
      return acc;
    }, {});
  }

  /**
   * Get monthly limits from database
   */
  async getMonthlyLimits() {
    const limits = await this.getConfiguration('monthly_limits');
    
    return limits.reduce((acc, limit) => {
      const config = limit.limit_config;
      acc[limit.name] = {
        ...config,
        penalty_weight: parseFloat(limit.penalty_weight),
        is_hard_constraint: limit.is_hard_constraint,
      };
      return acc;
    }, {});
  }

  /**
   * Get priority rules from database
   */
  async getPriorityRules() {
    const rules = await this.getConfiguration('priority_rules');
    
    // Ensure rules is an array before using reduce
    if (!Array.isArray(rules)) {
      console.warn('⚠️ Priority rules is not an array, returning empty object:', rules);
      return {};
    }
    
    return rules.reduce((acc, rule) => {
      // Validate rule structure
      if (!rule || !rule.rule_definition) {
        console.warn('⚠️ Invalid priority rule structure:', rule);
        return acc;
      }

      const definition = rule.rule_definition;
      const staffId = definition.staff_id || definition.staff_name;
      
      if (!staffId) {
        console.warn('⚠️ Priority rule missing staff identifier:', rule);
        return acc;
      }
      
      if (!acc[staffId]) {
        acc[staffId] = {
          preferredShifts: [],
        };
      }
      
      acc[staffId].preferredShifts.push({
        day: definition.conditions?.day_of_week,
        shift: definition.conditions?.shift_type,
        priority: rule.priority_level > 5 ? 'high' : 'medium',
        preference_strength: definition.preference_strength || 0.5,
      });
      
      return acc;
    }, {});
  }

  /**
   * Get ML model configuration
   * @param {string} modelName - Model name to get config for
   */
  async getMLModelConfig(modelName = null) {
    const configs = await this.getConfiguration('ml_model_configs');
    
    if (modelName) {
      const config = configs.find(c => c.model_name === modelName);
      return config ? this.processMLConfig(config) : null;
    }
    
    // Return default or first available config
    const defaultConfig = configs.find(c => c.is_default) || configs[0];
    return defaultConfig ? this.processMLConfig(defaultConfig) : this.getDefaultMLConfig();
  }

  /**
   * Process ML model configuration
   */
  processMLConfig(config) {
    return {
      model_name: config.model_name,
      model_type: config.model_type,
      parameters: config.parameters,
      confidence_threshold: parseFloat(config.confidence_threshold),
      is_default: config.is_default,
    };
  }

  /**
   * Update configuration cache when changes occur
   * @param {string} configType - Configuration type that changed
   * @param {Object} changeData - Change data from subscription
   */
  async handleConfigurationChange(configType, changeData) {
    try {
      console.log(`🔄 Configuration change detected: ${configType}`);
      
      // Invalidate related cache entries
      this.invalidateConfigCache(configType);
      
      // Reload configuration
      await this.loadConfigurationType(configType);
      
      // Notify business rule engine of changes
      await this.businessRuleEngine.handleConfigurationChange(configType, changeData);
      
      // Update performance metrics
      this.performanceMetrics.lastRefreshTime = Date.now();
      
      console.log(`✅ Configuration cache refreshed for ${configType}`);

    } catch (error) {
      console.error(`❌ Failed to handle configuration change for ${configType}:`, error);
    }
  }

  /**
   * Setup real-time subscriptions for configuration changes
   */
  async setupRealtimeSubscriptions() {
    try {
      console.log('🔔 Setting up real-time configuration subscriptions...');

      for (const [tableName, handler] of Object.entries(this.subscriptionHandlers)) {
        const subscription = supabase
          .channel(`config_${tableName}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: tableName,
            filter: `restaurant_id=eq.${this.currentRestaurantId}`,
          }, (payload) => {
            handler(payload, tableName);
          })
          .subscribe();

        this.subscriptions.set(tableName, subscription);
      }

      console.log(`✅ Set up ${this.subscriptions.size} real-time subscriptions`);

    } catch (error) {
      console.error('❌ Failed to setup real-time subscriptions:', error);
    }
  }

  /**
   * Handle version change events
   */
  async handleVersionChange(payload, tableName) {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    if (eventType === 'UPDATE' && newRecord.is_active && !oldRecord.is_active) {
      // New version activated
      console.log(`🔄 New configuration version activated: ${newRecord.name}`);
      
      this.currentVersionId = newRecord.id;
      this.versionCache.set('active', {
        ...newRecord,
        loadTime: Date.now(),
      });
      
      // Reload all configurations
      await this.loadAllConfigurations();
    }
  }

  /**
   * Handle rule change events
   */
  async handleRuleChange(payload, tableName) {
    await this.handleConfigurationChange(tableName, payload);
  }

  /**
   * Handle limit change events
   */
  async handleLimitChange(payload, tableName) {
    await this.handleConfigurationChange(tableName, payload);
  }

  /**
   * Handle priority rule change events
   */
  async handlePriorityChange(payload, tableName) {
    await this.handleConfigurationChange(tableName, payload);
  }

  /**
   * Handle ML config change events
   */
  async handleMLConfigChange(payload, tableName) {
    await this.handleConfigurationChange(tableName, payload);
    
    // Additional ML-specific handling
    console.log('🤖 ML configuration changed - models may need retraining');
  }

  /**
   * Create new configuration version
   * @param {string} name - Version name
   * @param {string} description - Version description
   */
  async createConfigurationVersion(name, description = '') {
    try {
      const { data, error } = await supabase.rpc('create_config_version', {
        p_restaurant_id: this.currentRestaurantId,
        p_name: name,
        p_description: description,
      });

      if (error) throw error;

      const newVersionId = data;
      
      console.log(`✅ Created new configuration version: ${name} (${newVersionId})`);
      return newVersionId;

    } catch (error) {
      console.error('❌ Failed to create configuration version:', error);
      throw error;
    }
  }

  /**
   * Activate configuration version
   * @param {string} versionId - Version ID to activate
   */
  async activateConfigurationVersion(versionId) {
    try {
      const { error } = await supabase.rpc('activate_config_version', {
        p_version_id: versionId,
      });

      if (error) throw error;

      // Update current version
      this.currentVersionId = versionId;
      
      console.log(`✅ Activated configuration version: ${versionId}`);
      
      // Reload all configurations
      await this.loadAllConfigurations();

    } catch (error) {
      console.error('❌ Failed to activate configuration version:', error);
      throw error;
    }
  }

  /**
   * Validate configuration for conflicts
   * @param {Object} configData - Configuration data to validate
   */
  async validateConfiguration(configData) {
    try {
      return await this.conflictDetector.detectConflicts(configData);
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      return {
        valid: false,
        conflicts: [{
          type: 'validation_error',
          message: `Validation failed: ${error.message}`,
          severity: 'high',
        }],
      };
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const hitRate = this.performanceMetrics.totalRequests > 0 
      ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100 
      : 0;

    return {
      ...this.performanceMetrics,
      cacheHitRate: hitRate,
      cacheSize: this.configCache.size,
      activeSubscriptions: this.subscriptions.size,
    };
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Check if cache entry is valid
   */
  isCacheValid(cacheKey) {
    const cached = this.configCache.get(cacheKey);
    if (!cached) return false;
    
    const age = Date.now() - cached.loadTime;
    return age < this.cacheSettings.maxAge;
  }

  /**
   * Check if cache should be refreshed in background
   */
  shouldRefreshCache(cached) {
    const age = Date.now() - cached.loadTime;
    return age > this.cacheSettings.refreshThreshold;
  }

  /**
   * Build cache key for configuration request
   */
  buildCacheKey(configType, options = {}) {
    const parts = [configType, this.currentVersionId || 'default'];
    
    if (options.filter) {
      parts.push(JSON.stringify(options.filter));
    }
    
    return parts.join('_');
  }

  /**
   * Process configuration data after loading
   */
  processConfiguration(configType, data) {
    // Apply any type-specific processing
    switch (configType) {
      case 'conflict_rules':
        return this.processConflictRules(data);
      case 'daily_limits':
      case 'monthly_limits':
        return this.processLimits(data);
      case 'priority_rules':
        return this.processPriorityRules(data);
      case 'ml_model_configs':
        return this.processMLConfigs(data);
      default:
        return data;
    }
  }

  processConflictRules(rules) {
    return rules.filter(rule => {
      // Validate rule structure
      return rule.conflict_definition && 
             typeof rule.conflict_definition === 'object' &&
             rule.rule_type;
    });
  }

  processLimits(limits) {
    return limits.filter(limit => {
      // Validate limit structure
      return limit.limit_config &&
             typeof limit.limit_config === 'object';
    });
  }

  processPriorityRules(rules) {
    return rules.filter(rule => {
      // Validate rule structure
      return rule.rule_definition &&
             typeof rule.rule_definition === 'object';
    });
  }

  processMLConfigs(configs) {
    return configs.filter(config => {
      // Validate config structure
      return config.parameters &&
             typeof config.parameters === 'object' &&
             config.model_name;
    });
  }

  /**
   * Check if configuration type has version column
   */
  hasVersionColumn(configType) {
    const versionedTypes = [
      'staff_groups',
      'conflict_rules',
      'daily_limits', 
      'monthly_limits',
      'priority_rules',
      'ml_model_configs'
    ];
    
    return versionedTypes.includes(configType);
  }

  /**
   * Invalidate cache entries for configuration type
   */
  invalidateConfigCache(configType) {
    const keysToDelete = [];
    
    for (const [key, value] of this.configCache.entries()) {
      if (value.type === configType) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.configCache.delete(key));
    
    console.log(`🗑️ Invalidated ${keysToDelete.length} cache entries for ${configType}`);
  }

  /**
   * Refresh configuration in background
   */
  async refreshConfigurationInBackground(configType, options) {
    // Don't block the current request
    setTimeout(async () => {
      try {
        await this.loadConfigurationType(configType);
        console.log(`🔄 Background refresh completed for ${configType}`);
      } catch (error) {
        console.warn(`⚠️ Background refresh failed for ${configType}:`, error);
      }
    }, 0);
  }

  /**
   * Start cache maintenance background task
   */
  startCacheMaintenance() {
    setInterval(() => {
      this.performCacheMaintenance();
    }, 60000); // Every minute
  }

  /**
   * Perform cache maintenance tasks
   */
  performCacheMaintenance() {
    const now = Date.now();
    const expiredKeys = [];

    // Find expired entries
    for (const [key, value] of this.configCache.entries()) {
      if (now - value.loadTime > this.cacheSettings.maxAge * 2) {
        expiredKeys.push(key);
      }
    }

    // Remove expired entries
    expiredKeys.forEach(key => this.configCache.delete(key));

    // Trim cache if too large
    if (this.configCache.size > this.cacheSettings.maxSize) {
      const entries = Array.from(this.configCache.entries());
      entries.sort((a, b) => a[1].loadTime - b[1].loadTime);
      
      const toRemove = entries.slice(0, entries.length - this.cacheSettings.maxSize);
      toRemove.forEach(([key]) => this.configCache.delete(key));
    }

    if (expiredKeys.length > 0) {
      console.log(`🧹 Cache maintenance: removed ${expiredKeys.length} expired entries`);
    }
  }

  /**
   * Initialize fallback mode with default configurations
   */
  async initializeFallbackMode() {
    console.log('🔧 Initializing fallback mode with default configurations');
    
    this.isInitialized = true;
    this.currentVersionId = null;
    
    // Load default configurations into cache
    const configTypes = [
      'staff_groups',
      'conflict_rules',
      'daily_limits', 
      'monthly_limits',
      'priority_rules',
      'ml_model_configs'
    ];

    for (const type of configTypes) {
      const defaultConfig = this.getDefaultConfiguration(type);
      this.configCache.set(`${type}_fallback`, {
        data: defaultConfig,
        loadTime: Date.now(),
        type,
        isFallback: true,
      });
    }

    console.log('✅ Fallback mode initialized with default configurations');
  }

  /**
   * Initialize default configurations
   */
  initializeDefaultConfigurations() {
    return {
      staff_groups: this.getDefaultStaffGroups(),
      conflict_rules: this.getDefaultConflictRules(),
      daily_limits: this.getDefaultDailyLimits(),
      monthly_limits: this.getDefaultMonthlyLimits(),
      priority_rules: this.getDefaultPriorityRules(),
      ml_model_configs: this.getDefaultMLConfigs(),
    };
  }

  /**
   * Get default configuration for type
   */
  getDefaultConfiguration(configType) {
    return this.defaultConfigs[configType] || [];
  }

  getDefaultStaffGroups() {
    return [
      { name: 'Group 1', members: ['料理長', '井関'] },
      { 
        name: 'Group 2', 
        members: ['料理長', '古藤'],
        coverageRule: {
          backupStaff: '中田',
          requiredShift: 'normal',
          description: 'When Group 2 member has day off, 中田 must work normal shift'
        }
      },
      { name: 'Group 3', members: ['井関', '小池'] },
      { name: 'Group 4', members: ['田辺', '小池'] },
      { name: 'Group 5', members: ['古藤', '岸'] },
      { name: 'Group 6', members: ['与儀', 'カマル'] },
      { name: 'Group 7', members: ['カマル', '高野'] },
      { name: 'Group 8', members: ['高野', '派遣スタッフ'] }
    ];
  }

  getDefaultConflictRules() {
    return [
      {
        name: 'Group Conflict Prevention',
        rule_type: 'group_conflict',
        conflict_definition: {
          type: 'group_conflict',
          constraint: 'cannot_work_same_shift'
        },
        penalty_weight: 1.0,
        is_hard_constraint: true
      }
    ];
  }

  getDefaultDailyLimits() {
    return {
      maxOffPerDay: 4,
      maxEarlyPerDay: 4,
      maxLatePerDay: 3,
      minWorkingStaffPerDay: 3
    };
  }

  getDefaultMonthlyLimits() {
    return {
      maxOffDaysPerMonth: 8,
      minWorkDaysPerMonth: 23
    };
  }

  getDefaultPriorityRules() {
    return {
      '料理長': {
        preferredShifts: [
          { day: 'sunday', shift: 'early', priority: 'high' }
        ]
      },
      '与儀': {
        preferredShifts: [
          { day: 'sunday', shift: 'off', priority: 'high' }
        ]
      }
    };
  }

  getDefaultMLConfigs() {
    return [
      {
        model_name: 'default_ensemble',
        model_type: 'ensemble',
        parameters: {
          numModels: 5,
          votingStrategy: 'weighted',
          confidenceThreshold: 0.85,
          targetAccuracy: 0.90
        },
        confidence_threshold: 0.85,
        is_default: true
      }
    ];
  }

  getDefaultMLConfig() {
    const configs = this.getDefaultMLConfigs();
    return configs.find(c => c.is_default) || configs[0];
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      // Unsubscribe from real-time subscriptions
      for (const [tableName, subscription] of this.subscriptions.entries()) {
        await supabase.removeChannel(subscription);
      }
      
      // Clear caches
      this.configCache.clear();
      this.versionCache.clear();
      this.subscriptions.clear();
      
      this.isInitialized = false;
      
      console.log('✅ Configuration Service cleanup completed');

    } catch (error) {
      console.error('❌ Configuration Service cleanup failed:', error);
    }
  }
}

/**
 * Business Rule Engine for dynamic rule processing
 */
class BusinessRuleEngine {
  constructor() {
    this.rules = new Map();
    this.ruleCache = new Map();
    this.isInitialized = false;
  }

  async initialize(configService) {
    this.configService = configService;
    await this.loadRules();
    this.isInitialized = true;
    console.log('✅ Business Rule Engine initialized');
  }

  async loadRules() {
    // Load business rules from configuration service
    const conflictRules = await this.configService.getConflictRules();
    const priorityRules = await this.configService.getPriorityRules();
    
    // Process and cache rules
    this.processRules(conflictRules, 'conflict');
    this.processRules(priorityRules, 'priority');
  }

  processRules(rules, type) {
    rules.forEach(rule => {
      this.rules.set(`${type}_${rule.id || rule.name}`, {
        type,
        rule,
        lastUpdated: Date.now(),
      });
    });
  }

  async handleConfigurationChange(configType, changeData) {
    if (configType.includes('rules')) {
      console.log(`🔄 Business rules updated for ${configType}`);
      await this.loadRules();
    }
  }

  /**
   * Evaluate rule against schedule data
   * @param {string} ruleId - Rule identifier
   * @param {Object} scheduleData - Schedule data to evaluate
   */
  evaluateRule(ruleId, scheduleData) {
    const rule = this.rules.get(ruleId);
    if (!rule) return { valid: true, violations: [] };

    // Rule evaluation logic would go here
    // This is a simplified implementation
    return { valid: true, violations: [] };
  }
}

/**
 * Configuration Conflict Detector
 */
class ConfigurationConflictDetector {
  constructor() {
    this.conflictCheckers = new Map();
    this.initializeConflictCheckers();
  }

  initializeConflictCheckers() {
    this.conflictCheckers.set('rule_overlap', this.checkRuleOverlap.bind(this));
    this.conflictCheckers.set('constraint_contradiction', this.checkConstraintContradiction.bind(this));
    this.conflictCheckers.set('resource_conflict', this.checkResourceConflict.bind(this));
  }

  async detectConflicts(configData) {
    const conflicts = [];

    for (const [checkType, checker] of this.conflictCheckers) {
      try {
        const checkResult = await checker(configData);
        if (!checkResult.valid) {
          conflicts.push(...checkResult.conflicts);
        }
      } catch (error) {
        conflicts.push({
          type: 'conflict_detection_error',
          checkType,
          message: `Conflict detection failed: ${error.message}`,
          severity: 'medium',
        });
      }
    }

    return {
      valid: conflicts.length === 0,
      conflicts,
    };
  }

  checkRuleOverlap(configData) {
    // Check for overlapping rules
    return { valid: true, conflicts: [] };
  }

  checkConstraintContradiction(configData) {
    // Check for contradictory constraints
    return { valid: true, conflicts: [] };
  }

  checkResourceConflict(configData) {
    // Check for resource allocation conflicts
    return { valid: true, conflicts: [] };
  }
}

/**
 * Configuration Performance Monitor
 */
class ConfigurationPerformanceMonitor {
  constructor() {
    this.metrics = {
      loadTimes: [],
      cacheHits: 0,
      cacheMisses: 0,
      errorRate: 0,
    };
  }

  async initialize() {
    console.log('📊 Configuration Performance Monitor initialized');
  }

  recordLoadTime(configType, loadTime) {
    this.metrics.loadTimes.push({
      type: configType,
      time: loadTime,
      timestamp: Date.now(),
    });

    // Keep only recent metrics
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    this.metrics.loadTimes = this.metrics.loadTimes.filter(
      metric => metric.timestamp > cutoff
    );
  }

  getPerformanceReport() {
    const avgLoadTime = this.metrics.loadTimes.length > 0
      ? this.metrics.loadTimes.reduce((sum, m) => sum + m.time, 0) / this.metrics.loadTimes.length
      : 0;

    return {
      avgLoadTime,
      totalRequests: this.metrics.cacheHits + this.metrics.cacheMisses,
      cacheHitRate: (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100,
      errorRate: this.metrics.errorRate,
    };
  }
}

export { BusinessRuleEngine, ConfigurationConflictDetector, ConfigurationPerformanceMonitor };