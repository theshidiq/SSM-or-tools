/**
 * BusinessRuleEngine.js
 *
 * Dynamic business rule engine with real-time updates, conflict detection,
 * and rule priority management for shift scheduling.
 *
 * Features:
 * - Dynamic rule loading from database
 * - Real-time rule updates without system restart
 * - Rule conflict detection and resolution
 * - Priority-based rule evaluation
 * - Rule dependency management
 * - Performance-optimized rule execution
 * - Rule validation and testing
 * - Audit trail for rule changes
 */

import { ConfigurationService } from "./ConfigurationService.js";
import { ConfigurationCacheManager } from "./ConfigurationCacheManager.js";

export class BusinessRuleEngine {
  constructor(restaurantId = null) {
    this.restaurantId = restaurantId;
    this.configService = null;
    this.cacheManager = null;

    // Rule storage and management
    this.rules = new Map(); // rule_id -> rule object
    this.rulesByCategory = new Map(); // category -> Set<rule_id>
    this.ruleDependencies = new Map(); // rule_id -> Set<dependency_rule_id>
    this.ruleConflicts = new Map(); // rule_id -> Set<conflicting_rule_id>

    // Rule execution context
    this.executionContext = {
      activeRules: new Set(),
      disabledRules: new Set(),
      ruleResults: new Map(),
      executionOrder: [],
      conflictResolutions: new Map(),
    };

    // Performance tracking
    this.performance = {
      totalRulesLoaded: 0,
      activeRules: 0,
      conflictingRules: 0,
      averageExecutionTime: 0,
      rulesExecuted: 0,
      lastUpdateTime: 0,
      cacheHitRate: 0,
    };

    // Rule categories
    this.categories = {
      STAFF_AVAILABILITY: "staff_availability",
      SHIFT_PATTERNS: "shift_patterns",
      BUSINESS_CONSTRAINTS: "business_constraints",
      PREFERENCE_RULES: "preference_rules",
      REGULATORY_COMPLIANCE: "regulatory_compliance",
      CUSTOM_BUSINESS_LOGIC: "custom_business_logic",
    };

    // Conflict resolution strategies
    this.conflictStrategies = {
      PRIORITY: "priority", // Higher priority wins
      LATEST: "latest", // Most recently updated wins
      STRICT: "strict", // Block conflicting rules
      MERGE: "merge", // Attempt to merge conditions
      USER_DEFINED: "user_defined", // Custom resolution logic
    };

    // Real-time subscription handlers
    this.subscriptions = new Map();
    this.isInitialized = false;
    this.isUpdating = false;

    // Event handlers for rule changes
    this.eventHandlers = {
      ruleAdded: [],
      ruleUpdated: [],
      ruleDeleted: [],
      conflictDetected: [],
      conflictResolved: [],
      rulesReloaded: [],
    };
  }

  /**
   * Initialize the business rule engine
   */
  async initialize(options = {}) {
    if (this.isInitialized) return true;

    try {
      console.log("🔧 Initializing Business Rule Engine...");
      const startTime = Date.now();

      // Initialize configuration service
      if (this.restaurantId) {
        this.configService = new ConfigurationService();
        await this.configService.initialize({
          restaurantId: this.restaurantId,
        });

        // Initialize cache manager
        this.cacheManager = new ConfigurationCacheManager({
          maxMemoryUsage: 10 * 1024 * 1024, // 10MB for rules
          defaultTTL: 15 * 60 * 1000, // 15 minutes
          maxCacheSize: 500,
        });
        await this.cacheManager.initialize();

        console.log("✅ Configuration service connected for rule engine");
      }

      // Load initial rules from database
      await this.loadRulesFromDatabase();

      // Build rule dependency graph
      await this.buildDependencyGraph();

      // Detect and resolve conflicts
      await this.detectConflicts();

      // Set up real-time subscriptions
      await this.setupRealtimeSubscriptions();

      // Build execution order
      this.buildExecutionOrder();

      this.isInitialized = true;
      const initTime = Date.now() - startTime;

      console.log(`✅ Business Rule Engine initialized in ${initTime}ms`);
      console.log(
        `📊 Loaded ${this.performance.totalRulesLoaded} rules with ${this.performance.conflictingRules} conflicts`,
      );

      return true;
    } catch (error) {
      console.error("❌ Business Rule Engine initialization failed:", error);
      return false;
    }
  }

  /**
   * Load rules from database
   */
  async loadRulesFromDatabase() {
    try {
      if (!this.configService) {
        console.warn("⚠️ No configuration service available for rule loading");
        return;
      }

      console.log("📋 Loading business rules from database...");

      // Check cache first
      const cacheKey = `business_rules_${this.restaurantId}`;
      let rulesData = null;

      if (this.cacheManager) {
        rulesData = await this.cacheManager.get(cacheKey);
      }

      if (!rulesData) {
        // Load from database
        rulesData = await this.configService.getBusinessRules();

        if (rulesData && this.cacheManager) {
          // Cache rules data
          await this.cacheManager.set(cacheKey, rulesData, {
            ttl: 10 * 60 * 1000, // 10 minutes
            priority: "high",
          });
        }
      }

      if (!rulesData || !Array.isArray(rulesData)) {
        console.warn("⚠️ No business rules found in database");
        return;
      }

      // Process and store rules
      for (const ruleData of rulesData) {
        const rule = this.parseRule(ruleData);
        if (rule) {
          this.addRule(rule);
        }
      }

      this.performance.totalRulesLoaded = this.rules.size;
      this.performance.lastUpdateTime = Date.now();

      console.log(
        `✅ Loaded ${this.performance.totalRulesLoaded} business rules`,
      );
    } catch (error) {
      console.error("❌ Failed to load rules from database:", error);
    }
  }

  /**
   * Parse raw rule data into rule object
   */
  parseRule(ruleData) {
    try {
      return {
        id: ruleData.id,
        name: ruleData.name || `Rule ${ruleData.id}`,
        description: ruleData.description || "",
        category: ruleData.category || this.categories.CUSTOM_BUSINESS_LOGIC,
        priority: ruleData.priority || 100,
        isActive: ruleData.is_active !== false,
        conditions: this.parseConditions(ruleData.conditions),
        actions: this.parseActions(ruleData.actions),
        dependencies: ruleData.dependencies || [],
        conflictsWith: ruleData.conflicts_with || [],
        conflictResolution:
          ruleData.conflict_resolution || this.conflictStrategies.PRIORITY,
        metadata: {
          createdAt: new Date(ruleData.created_at || Date.now()),
          updatedAt: new Date(ruleData.updated_at || Date.now()),
          createdBy: ruleData.created_by || "system",
          version: ruleData.version || 1,
          tags: ruleData.tags || [],
        },
        executionData: {
          timesExecuted: 0,
          averageExecutionTime: 0,
          lastExecuted: null,
          successRate: 1.0,
        },
      };
    } catch (error) {
      console.error(`❌ Failed to parse rule ${ruleData.id}:`, error);
      return null;
    }
  }

  /**
   * Parse rule conditions
   */
  parseConditions(conditionsData) {
    if (!conditionsData) return [];

    try {
      // Handle different condition formats
      if (typeof conditionsData === "string") {
        conditionsData = JSON.parse(conditionsData);
      }

      if (!Array.isArray(conditionsData)) {
        conditionsData = [conditionsData];
      }

      return conditionsData.map((condition) => ({
        field: condition.field,
        operator: condition.operator, // 'equals', 'not_equals', 'greater_than', 'less_than', 'contains', etc.
        value: condition.value,
        logicalOperator: condition.logical_operator || "AND", // 'AND', 'OR'
        negated: condition.negated || false,
      }));
    } catch (error) {
      console.error("Failed to parse conditions:", error);
      return [];
    }
  }

  /**
   * Parse rule actions
   */
  parseActions(actionsData) {
    if (!actionsData) return [];

    try {
      if (typeof actionsData === "string") {
        actionsData = JSON.parse(actionsData);
      }

      if (!Array.isArray(actionsData)) {
        actionsData = [actionsData];
      }

      return actionsData.map((action) => ({
        type: action.type, // 'block', 'allow', 'modify', 'notify', etc.
        target: action.target,
        value: action.value,
        parameters: action.parameters || {},
      }));
    } catch (error) {
      console.error("Failed to parse actions:", error);
      return [];
    }
  }

  /**
   * Add rule to the engine
   */
  addRule(rule) {
    this.rules.set(rule.id, rule);

    // Add to category index
    if (!this.rulesByCategory.has(rule.category)) {
      this.rulesByCategory.set(rule.category, new Set());
    }
    this.rulesByCategory.get(rule.category).add(rule.id);

    // Add to active rules if enabled
    if (rule.isActive) {
      this.executionContext.activeRules.add(rule.id);
      this.performance.activeRules++;
    }

    // Emit event
    this.emitEvent("ruleAdded", { rule });
  }

  /**
   * Update existing rule
   */
  async updateRule(ruleId, updatedData) {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    try {
      this.isUpdating = true;

      // Create updated rule
      const updatedRule = {
        ...existingRule,
        ...updatedData,
        metadata: {
          ...existingRule.metadata,
          updatedAt: new Date(),
          version: existingRule.metadata.version + 1,
        },
      };

      // Validate updated rule
      const validation = await this.validateRule(updatedRule);
      if (!validation.isValid) {
        throw new Error(
          `Rule validation failed: ${validation.errors.join(", ")}`,
        );
      }

      // Check for new conflicts
      const conflictCheck = await this.checkRuleConflicts(updatedRule);
      if (
        conflictCheck.hasConflicts &&
        updatedRule.conflictResolution === this.conflictStrategies.STRICT
      ) {
        throw new Error(
          `Rule conflicts detected: ${conflictCheck.conflicts.join(", ")}`,
        );
      }

      // Update rule
      this.rules.set(ruleId, updatedRule);

      // Update indexes and execution context
      await this.rebuildIndexes();
      await this.detectConflicts();
      this.buildExecutionOrder();

      // Update cache
      if (this.cacheManager) {
        await this.cacheManager.delete(`business_rules_${this.restaurantId}`);
      }

      // Emit event
      this.emitEvent("ruleUpdated", {
        oldRule: existingRule,
        newRule: updatedRule,
        conflicts: conflictCheck.conflicts,
      });

      console.log(`✅ Rule ${ruleId} updated successfully`);
      return updatedRule;
    } catch (error) {
      console.error(`❌ Failed to update rule ${ruleId}:`, error);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Build dependency graph for rules
   */
  async buildDependencyGraph() {
    this.ruleDependencies.clear();

    for (const [ruleId, rule] of this.rules) {
      const dependencies = new Set();

      // Process explicit dependencies
      if (rule.dependencies && rule.dependencies.length > 0) {
        for (const depId of rule.dependencies) {
          if (this.rules.has(depId)) {
            dependencies.add(depId);
          }
        }
      }

      // Analyze implicit dependencies based on conditions
      const implicitDeps = await this.analyzeImplicitDependencies(rule);
      implicitDeps.forEach((dep) => dependencies.add(dep));

      this.ruleDependencies.set(ruleId, dependencies);
    }

    console.log("📊 Built dependency graph for rules");
  }

  /**
   * Analyze implicit dependencies
   */
  async analyzeImplicitDependencies(rule) {
    const dependencies = new Set();

    // Analyze rule conditions to find dependencies on other rules
    for (const condition of rule.conditions) {
      // Check if condition depends on results of other rules
      if (condition.field && condition.field.startsWith("rule_result_")) {
        const dependentRuleId = condition.field.replace("rule_result_", "");
        if (this.rules.has(dependentRuleId)) {
          dependencies.add(dependentRuleId);
        }
      }
    }

    return dependencies;
  }

  /**
   * Detect conflicts between rules
   */
  async detectConflicts() {
    console.log("🔍 Detecting rule conflicts...");
    this.ruleConflicts.clear();
    let conflictCount = 0;

    for (const [ruleId, rule] of this.rules) {
      const conflicts = new Set();

      // Check explicit conflicts
      if (rule.conflictsWith && rule.conflictsWith.length > 0) {
        for (const conflictId of rule.conflictsWith) {
          if (
            this.rules.has(conflictId) &&
            this.rules.get(conflictId).isActive
          ) {
            conflicts.add(conflictId);
          }
        }
      }

      // Detect implicit conflicts
      const implicitConflicts = await this.analyzeImplicitConflicts(rule);
      implicitConflicts.forEach((conflictId) => conflicts.add(conflictId));

      if (conflicts.size > 0) {
        this.ruleConflicts.set(ruleId, conflicts);
        conflictCount += conflicts.size;

        // Attempt to resolve conflicts
        await this.resolveConflicts(ruleId, conflicts);
      }
    }

    this.performance.conflictingRules = conflictCount;
    console.log(`🔍 Detected ${conflictCount} rule conflicts`);
  }

  /**
   * Analyze implicit conflicts between rules
   */
  async analyzeImplicitConflicts(rule) {
    const conflicts = new Set();

    for (const [otherRuleId, otherRule] of this.rules) {
      if (otherRuleId === rule.id || !otherRule.isActive) continue;

      // Check for conflicting actions on the same target
      const hasConflictingActions = this.hasConflictingActions(rule, otherRule);
      if (hasConflictingActions) {
        conflicts.add(otherRuleId);
      }

      // Check for contradictory conditions
      const hasContradictoryConditions = this.hasContradictoryConditions(
        rule,
        otherRule,
      );
      if (hasContradictoryConditions) {
        conflicts.add(otherRuleId);
      }
    }

    return conflicts;
  }

  /**
   * Check for conflicting actions
   */
  hasConflictingActions(rule1, rule2) {
    for (const action1 of rule1.actions) {
      for (const action2 of rule2.actions) {
        // Same target but opposite actions
        if (action1.target === action2.target) {
          if (
            (action1.type === "allow" && action2.type === "block") ||
            (action1.type === "block" && action2.type === "allow") ||
            (action1.type === "modify" &&
              action2.type === "modify" &&
              action1.value !== action2.value)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Check for contradictory conditions
   */
  hasContradictoryConditions(rule1, rule2) {
    for (const condition1 of rule1.conditions) {
      for (const condition2 of rule2.conditions) {
        // Same field but contradictory values
        if (condition1.field === condition2.field) {
          if (
            (condition1.operator === "equals" &&
              condition2.operator === "not_equals" &&
              condition1.value === condition2.value) ||
            (condition1.operator === "greater_than" &&
              condition2.operator === "less_than" &&
              condition1.value >= condition2.value)
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Resolve conflicts between rules
   */
  async resolveConflicts(ruleId, conflicts) {
    const rule = this.rules.get(ruleId);
    const resolutionStrategy = rule.conflictResolution;

    for (const conflictId of conflicts) {
      const conflictingRule = this.rules.get(conflictId);
      let resolution = null;

      switch (resolutionStrategy) {
        case this.conflictStrategies.PRIORITY:
          resolution = this.resolvePriorityConflict(rule, conflictingRule);
          break;

        case this.conflictStrategies.LATEST:
          resolution = this.resolveLatestConflict(rule, conflictingRule);
          break;

        case this.conflictStrategies.STRICT:
          resolution = this.resolveStrictConflict(rule, conflictingRule);
          break;

        case this.conflictStrategies.MERGE:
          resolution = await this.resolveMergeConflict(rule, conflictingRule);
          break;

        default:
          resolution = { action: "log", winner: null };
      }

      // Store resolution
      this.executionContext.conflictResolutions.set(
        `${ruleId}_${conflictId}`,
        resolution,
      );

      // Apply resolution
      await this.applyConflictResolution(rule, conflictingRule, resolution);

      // Emit event
      this.emitEvent("conflictResolved", {
        rule1: rule,
        rule2: conflictingRule,
        resolution: resolution,
      });
    }
  }

  /**
   * Resolve priority-based conflicts
   */
  resolvePriorityConflict(rule1, rule2) {
    const winner = rule1.priority > rule2.priority ? rule1 : rule2;
    const loser = winner === rule1 ? rule2 : rule1;

    return {
      strategy: "priority",
      winner: winner.id,
      loser: loser.id,
      action: "disable_loser",
      reason: `Rule ${winner.id} has higher priority (${winner.priority}) than rule ${loser.id} (${loser.priority})`,
    };
  }

  /**
   * Resolve latest-update conflicts
   */
  resolveLatestConflict(rule1, rule2) {
    const winner =
      rule1.metadata.updatedAt > rule2.metadata.updatedAt ? rule1 : rule2;
    const loser = winner === rule1 ? rule2 : rule1;

    return {
      strategy: "latest",
      winner: winner.id,
      loser: loser.id,
      action: "disable_loser",
      reason: `Rule ${winner.id} was updated more recently`,
    };
  }

  /**
   * Resolve strict conflicts (block both)
   */
  resolveStrictConflict(rule1, rule2) {
    return {
      strategy: "strict",
      winner: null,
      loser: null,
      action: "disable_both",
      reason: "Strict conflict resolution - both rules disabled",
    };
  }

  /**
   * Resolve merge conflicts
   */
  async resolveMergeConflict(rule1, rule2) {
    // Attempt to merge compatible parts
    try {
      const mergedConditions = this.mergeConditions(
        rule1.conditions,
        rule2.conditions,
      );
      const mergedActions = this.mergeActions(rule1.actions, rule2.actions);

      if (mergedConditions && mergedActions) {
        return {
          strategy: "merge",
          winner: null,
          loser: null,
          action: "create_merged_rule",
          mergedRule: {
            id: `merged_${rule1.id}_${rule2.id}`,
            name: `Merged: ${rule1.name} + ${rule2.name}`,
            conditions: mergedConditions,
            actions: mergedActions,
            priority: Math.max(rule1.priority, rule2.priority),
          },
          reason: "Rules successfully merged",
        };
      } else {
        // Fallback to priority resolution
        return this.resolvePriorityConflict(rule1, rule2);
      }
    } catch (error) {
      console.warn(
        "Failed to merge conflicting rules, falling back to priority resolution",
      );
      return this.resolvePriorityConflict(rule1, rule2);
    }
  }

  /**
   * Apply conflict resolution
   */
  async applyConflictResolution(rule1, rule2, resolution) {
    switch (resolution.action) {
      case "disable_loser":
        const loserId = resolution.loser;
        this.executionContext.activeRules.delete(loserId);
        this.executionContext.disabledRules.add(loserId);
        console.log(`🔧 Disabled rule ${loserId} due to conflict resolution`);
        break;

      case "disable_both":
        this.executionContext.activeRules.delete(rule1.id);
        this.executionContext.activeRules.delete(rule2.id);
        this.executionContext.disabledRules.add(rule1.id);
        this.executionContext.disabledRules.add(rule2.id);
        console.log(
          `🔧 Disabled both rules ${rule1.id} and ${rule2.id} due to strict conflict`,
        );
        break;

      case "create_merged_rule":
        // Add merged rule and disable originals
        this.addRule(resolution.mergedRule);
        this.executionContext.activeRules.delete(rule1.id);
        this.executionContext.activeRules.delete(rule2.id);
        console.log(`🔧 Created merged rule ${resolution.mergedRule.id}`);
        break;

      default:
        console.log(`📝 Logged conflict between ${rule1.id} and ${rule2.id}`);
    }
  }

  /**
   * Build optimal execution order
   */
  buildExecutionOrder() {
    const executionOrder = [];
    const visited = new Set();
    const inProgress = new Set();

    // Topological sort considering dependencies and priorities
    const visit = (ruleId) => {
      if (inProgress.has(ruleId)) {
        console.warn(
          `⚠️ Circular dependency detected involving rule ${ruleId}`,
        );
        return;
      }

      if (visited.has(ruleId)) {
        return;
      }

      inProgress.add(ruleId);

      // Visit dependencies first
      const dependencies = this.ruleDependencies.get(ruleId) || new Set();
      for (const depId of dependencies) {
        if (this.executionContext.activeRules.has(depId)) {
          visit(depId);
        }
      }

      inProgress.delete(ruleId);
      visited.add(ruleId);
      executionOrder.push(ruleId);
    };

    // Sort active rules by priority first
    const activeRulesArray = Array.from(this.executionContext.activeRules);
    activeRulesArray.sort((a, b) => {
      const ruleA = this.rules.get(a);
      const ruleB = this.rules.get(b);
      return ruleB.priority - ruleA.priority; // Higher priority first
    });

    // Visit all active rules
    for (const ruleId of activeRulesArray) {
      visit(ruleId);
    }

    this.executionContext.executionOrder = executionOrder;
    console.log(
      `📊 Built execution order for ${executionOrder.length} active rules`,
    );
  }

  /**
   * Execute rules for given context
   */
  async executeRules(context) {
    if (!this.isInitialized) {
      throw new Error("Business Rule Engine not initialized");
    }

    const startTime = Date.now();
    const results = new Map();
    let executedCount = 0;

    try {
      // Execute rules in dependency order
      for (const ruleId of this.executionContext.executionOrder) {
        const rule = this.rules.get(ruleId);
        if (!rule || !rule.isActive) continue;

        const ruleStartTime = Date.now();

        try {
          // Evaluate rule conditions
          const conditionResult = await this.evaluateConditions(
            rule,
            context,
            results,
          );

          if (conditionResult.passed) {
            // Execute rule actions
            const actionResult = await this.executeActions(rule, context);

            const result = {
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              conditionResult: conditionResult,
              actionResult: actionResult,
              executionTime: Date.now() - ruleStartTime,
              success: true,
            };

            results.set(ruleId, result);
            executedCount++;

            // Update rule execution stats
            rule.executionData.timesExecuted++;
            rule.executionData.lastExecuted = new Date();
            rule.executionData.averageExecutionTime =
              (rule.executionData.averageExecutionTime + result.executionTime) /
              2;
          } else {
            // Rule conditions not met
            results.set(ruleId, {
              ruleId: rule.id,
              ruleName: rule.name,
              category: rule.category,
              conditionResult: conditionResult,
              actionResult: null,
              executionTime: Date.now() - ruleStartTime,
              success: true,
              skipped: true,
            });
          }
        } catch (error) {
          console.error(`❌ Rule ${ruleId} execution failed:`, error);
          results.set(ruleId, {
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            error: error.message,
            executionTime: Date.now() - ruleStartTime,
            success: false,
          });

          // Update error rate
          rule.executionData.successRate =
            (rule.executionData.successRate * rule.executionData.timesExecuted -
              1) /
            (rule.executionData.timesExecuted + 1);
        }
      }

      // Update performance metrics
      const totalExecutionTime = Date.now() - startTime;
      this.performance.averageExecutionTime =
        (this.performance.averageExecutionTime + totalExecutionTime) / 2;
      this.performance.rulesExecuted += executedCount;

      return {
        success: true,
        executedRules: executedCount,
        totalExecutionTime: totalExecutionTime,
        results: Object.fromEntries(results),
      };
    } catch (error) {
      console.error("❌ Rule execution failed:", error);
      return {
        success: false,
        error: error.message,
        executedRules: executedCount,
        results: Object.fromEntries(results),
      };
    }
  }

  /**
   * Evaluate rule conditions
   */
  async evaluateConditions(rule, context, previousResults) {
    const conditionResults = [];
    let overallResult = true;
    let logicalOperator = "AND";

    for (const condition of rule.conditions) {
      let conditionMet = false;
      let actualValue = null;

      try {
        // Get the field value from context
        actualValue = this.getFieldValue(
          condition.field,
          context,
          previousResults,
        );

        // Evaluate condition
        conditionMet = this.evaluateCondition(condition, actualValue);

        // Apply negation if specified
        if (condition.negated) {
          conditionMet = !conditionMet;
        }

        conditionResults.push({
          field: condition.field,
          operator: condition.operator,
          expectedValue: condition.value,
          actualValue: actualValue,
          result: conditionMet,
          negated: condition.negated,
        });

        // Apply logical operator
        if (condition.logicalOperator === "OR") {
          logicalOperator = "OR";
        }
      } catch (error) {
        console.warn(
          `⚠️ Condition evaluation failed for ${condition.field}:`,
          error,
        );
        conditionResults.push({
          field: condition.field,
          operator: condition.operator,
          expectedValue: condition.value,
          actualValue: null,
          result: false,
          error: error.message,
        });
        conditionMet = false;
      }

      // Update overall result based on logical operator
      if (logicalOperator === "AND") {
        overallResult = overallResult && conditionMet;
      } else if (logicalOperator === "OR") {
        overallResult = overallResult || conditionMet;
      }
    }

    return {
      passed: overallResult,
      logicalOperator: logicalOperator,
      conditions: conditionResults,
    };
  }

  /**
   * Get field value from context
   */
  getFieldValue(field, context, previousResults) {
    // Handle rule result references
    if (field.startsWith("rule_result_")) {
      const ruleId = field.replace("rule_result_", "");
      const result = previousResults.get(ruleId);
      return result ? result.success : false;
    }

    // Handle nested field access
    const fieldParts = field.split(".");
    let value = context;

    for (const part of fieldParts) {
      if (value && typeof value === "object" && part in value) {
        value = value[part];
      } else {
        throw new Error(`Field ${field} not found in context`);
      }
    }

    return value;
  }

  /**
   * Evaluate single condition
   */
  evaluateCondition(condition, actualValue) {
    const { operator, value: expectedValue } = condition;

    switch (operator) {
      case "equals":
        return actualValue === expectedValue;

      case "not_equals":
        return actualValue !== expectedValue;

      case "greater_than":
        return Number(actualValue) > Number(expectedValue);

      case "greater_than_or_equal":
        return Number(actualValue) >= Number(expectedValue);

      case "less_than":
        return Number(actualValue) < Number(expectedValue);

      case "less_than_or_equal":
        return Number(actualValue) <= Number(expectedValue);

      case "contains":
        return String(actualValue).includes(String(expectedValue));

      case "not_contains":
        return !String(actualValue).includes(String(expectedValue));

      case "in":
        return (
          Array.isArray(expectedValue) && expectedValue.includes(actualValue)
        );

      case "not_in":
        return (
          Array.isArray(expectedValue) && !expectedValue.includes(actualValue)
        );

      case "regex":
        const regex = new RegExp(expectedValue);
        return regex.test(String(actualValue));

      case "is_null":
        return actualValue === null || actualValue === undefined;

      case "is_not_null":
        return actualValue !== null && actualValue !== undefined;

      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Execute rule actions
   */
  async executeActions(rule, context) {
    const actionResults = [];

    for (const action of rule.actions) {
      try {
        const result = await this.executeAction(action, context);
        actionResults.push({
          type: action.type,
          target: action.target,
          value: action.value,
          parameters: action.parameters,
          result: result,
          success: true,
        });
      } catch (error) {
        console.error(`❌ Action execution failed:`, error);
        actionResults.push({
          type: action.type,
          target: action.target,
          value: action.value,
          error: error.message,
          success: false,
        });
      }
    }

    return actionResults;
  }

  /**
   * Execute single action
   */
  async executeAction(action, context) {
    switch (action.type) {
      case "block":
        // Block the operation
        context.blocked = true;
        context.blockReason = action.value || "Blocked by business rule";
        return { blocked: true, reason: context.blockReason };

      case "allow":
        // Explicitly allow the operation
        context.allowed = true;
        return { allowed: true };

      case "modify":
        // Modify context value
        if (action.target && action.value !== undefined) {
          this.setFieldValue(action.target, context, action.value);
          return {
            modified: true,
            target: action.target,
            newValue: action.value,
          };
        }
        break;

      case "notify":
        // Send notification
        console.log(`📢 Rule notification: ${action.value}`);
        return { notified: true, message: action.value };

      case "log":
        // Log information
        console.log(`📝 Rule log: ${action.value}`);
        return { logged: true, message: action.value };

      case "set_preference":
        // Set preference value
        if (!context.preferences) context.preferences = {};
        context.preferences[action.target] = action.value;
        return {
          preferenceSet: true,
          target: action.target,
          value: action.value,
        };

      case "add_constraint":
        // Add constraint
        if (!context.constraints) context.constraints = [];
        context.constraints.push({
          type: action.target,
          value: action.value,
          parameters: action.parameters,
        });
        return { constraintAdded: true, constraint: action.target };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Set field value in context
   */
  setFieldValue(field, context, value) {
    const fieldParts = field.split(".");
    let current = context;

    for (let i = 0; i < fieldParts.length - 1; i++) {
      const part = fieldParts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    const lastPart = fieldParts[fieldParts.length - 1];
    current[lastPart] = value;
  }

  /**
   * Setup real-time subscriptions for rule updates
   */
  async setupRealtimeSubscriptions() {
    if (!this.configService || !this.configService.supabase) {
      console.warn("⚠️ No real-time subscriptions available");
      return;
    }

    try {
      // Subscribe to business rules table changes
      const subscription = this.configService.supabase
        .channel(`business_rules_${this.restaurantId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "business_rules",
            filter: `restaurant_id=eq.${this.restaurantId}`,
          },
          async (payload) => {
            await this.handleRuleChange(payload);
          },
        )
        .subscribe();

      this.subscriptions.set("business_rules", subscription);
      console.log("✅ Real-time rule subscriptions established");
    } catch (error) {
      console.error("❌ Failed to setup real-time subscriptions:", error);
    }
  }

  /**
   * Handle real-time rule changes
   */
  async handleRuleChange(payload) {
    if (this.isUpdating) {
      console.log("⏳ Skipping real-time update - manual update in progress");
      return;
    }

    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case "INSERT":
          console.log(`📥 New rule added: ${newRecord.id}`);
          const newRule = this.parseRule(newRecord);
          if (newRule) {
            this.addRule(newRule);
            await this.rebuildAfterChange();
            this.emitEvent("ruleAdded", { rule: newRule });
          }
          break;

        case "UPDATE":
          console.log(`📝 Rule updated: ${newRecord.id}`);
          const updatedRule = this.parseRule(newRecord);
          if (updatedRule) {
            const oldRule = this.rules.get(newRecord.id);
            this.rules.set(newRecord.id, updatedRule);
            await this.rebuildAfterChange();
            this.emitEvent("ruleUpdated", { oldRule, newRule: updatedRule });
          }
          break;

        case "DELETE":
          console.log(`🗑️ Rule deleted: ${oldRecord.id}`);
          await this.deleteRule(oldRecord.id);
          this.emitEvent("ruleDeleted", { ruleId: oldRecord.id });
          break;

        default:
          console.log(`Unknown event type: ${eventType}`);
      }

      // Clear cache after changes
      if (this.cacheManager) {
        await this.cacheManager.delete(`business_rules_${this.restaurantId}`);
      }
    } catch (error) {
      console.error("❌ Failed to handle rule change:", error);
    }
  }

  /**
   * Rebuild indexes after rule changes
   */
  async rebuildAfterChange() {
    await this.rebuildIndexes();
    await this.buildDependencyGraph();
    await this.detectConflicts();
    this.buildExecutionOrder();

    this.performance.totalRulesLoaded = this.rules.size;
    this.performance.activeRules = this.executionContext.activeRules.size;

    this.emitEvent("rulesReloaded", {
      totalRules: this.performance.totalRulesLoaded,
      activeRules: this.performance.activeRules,
    });
  }

  /**
   * Rebuild category indexes
   */
  async rebuildIndexes() {
    this.rulesByCategory.clear();

    for (const [ruleId, rule] of this.rules) {
      if (!this.rulesByCategory.has(rule.category)) {
        this.rulesByCategory.set(rule.category, new Set());
      }
      this.rulesByCategory.get(rule.category).add(ruleId);
    }
  }

  /**
   * Delete rule from engine
   */
  async deleteRule(ruleId) {
    if (!this.rules.has(ruleId)) return;

    const rule = this.rules.get(ruleId);

    // Remove from all collections
    this.rules.delete(ruleId);
    this.executionContext.activeRules.delete(ruleId);
    this.executionContext.disabledRules.delete(ruleId);
    this.ruleDependencies.delete(ruleId);
    this.ruleConflicts.delete(ruleId);

    // Remove from category index
    if (this.rulesByCategory.has(rule.category)) {
      this.rulesByCategory.get(rule.category).delete(ruleId);
    }

    // Remove from dependency references
    for (const [otherId, deps] of this.ruleDependencies) {
      deps.delete(ruleId);
    }

    // Remove from conflict references
    for (const [otherId, conflicts] of this.ruleConflicts) {
      conflicts.delete(ruleId);
    }

    await this.rebuildAfterChange();
  }

  /**
   * Validate rule structure and logic
   */
  async validateRule(rule) {
    const errors = [];

    // Basic structure validation
    if (!rule.id) errors.push("Rule ID is required");
    if (!rule.name) errors.push("Rule name is required");
    if (!rule.category) errors.push("Rule category is required");
    if (!Array.isArray(rule.conditions))
      errors.push("Rule conditions must be an array");
    if (!Array.isArray(rule.actions))
      errors.push("Rule actions must be an array");

    // Condition validation
    for (const [index, condition] of rule.conditions.entries()) {
      if (!condition.field)
        errors.push(`Condition ${index}: field is required`);
      if (!condition.operator)
        errors.push(`Condition ${index}: operator is required`);
      if (condition.value === undefined)
        errors.push(`Condition ${index}: value is required`);
    }

    // Action validation
    for (const [index, action] of rule.actions.entries()) {
      if (!action.type) errors.push(`Action ${index}: type is required`);
    }

    // Dependency validation
    if (rule.dependencies && rule.dependencies.length > 0) {
      for (const depId of rule.dependencies) {
        if (!this.rules.has(depId)) {
          errors.push(`Dependency rule ${depId} not found`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
    };
  }

  /**
   * Check rule for conflicts
   */
  async checkRuleConflicts(rule) {
    const conflicts = [];

    for (const [otherId, otherRule] of this.rules) {
      if (otherId === rule.id || !otherRule.isActive) continue;

      if (
        this.hasConflictingActions(rule, otherRule) ||
        this.hasContradictoryConditions(rule, otherRule)
      ) {
        conflicts.push(otherId);
      }
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts,
    };
  }

  /**
   * Helper methods for merging rules
   */
  mergeConditions(conditions1, conditions2) {
    // Simple merge - combine all conditions with AND
    return [...conditions1, ...conditions2];
  }

  mergeActions(actions1, actions2) {
    // Check for conflicting actions
    for (const action1 of actions1) {
      for (const action2 of actions2) {
        if (
          action1.target === action2.target &&
          action1.type !== action2.type
        ) {
          return null; // Cannot merge conflicting actions
        }
      }
    }

    // Merge compatible actions
    return [...actions1, ...actions2];
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category) {
    const ruleIds = this.rulesByCategory.get(category) || new Set();
    return Array.from(ruleIds)
      .map((id) => this.rules.get(id))
      .filter(Boolean);
  }

  /**
   * Get rule performance metrics
   */
  getRulePerformance(ruleId) {
    const rule = this.rules.get(ruleId);
    return rule ? rule.executionData : null;
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      updating: this.isUpdating,
      performance: this.performance,
      activeRules: this.executionContext.activeRules.size,
      totalRules: this.rules.size,
      disabledRules: this.executionContext.disabledRules.size,
      conflictingRules: this.ruleConflicts.size,
      categories: Object.keys(this.categories).length,
      subscriptions: this.subscriptions.size,
    };
  }

  /**
   * Register event handler
   */
  on(eventName, handler) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].push(handler);
    }
  }

  /**
   * Emit event to registered handlers
   */
  emitEvent(eventName, data) {
    const handlers = this.eventHandlers[eventName] || [];
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`❌ Event handler error for ${eventName}:`, error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    // Close subscriptions
    for (const [name, subscription] of this.subscriptions) {
      if (subscription && typeof subscription.unsubscribe === "function") {
        subscription.unsubscribe();
      }
    }
    this.subscriptions.clear();

    // Cleanup cache manager
    if (this.cacheManager) {
      await this.cacheManager.cleanup();
    }

    // Clear data structures
    this.rules.clear();
    this.rulesByCategory.clear();
    this.ruleDependencies.clear();
    this.ruleConflicts.clear();

    this.isInitialized = false;
    console.log("✅ Business Rule Engine cleaned up");
  }
}

export default BusinessRuleEngine;
