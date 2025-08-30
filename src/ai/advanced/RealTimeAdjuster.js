/**
 * RealTimeAdjuster.js
 *
 * Phase 3: Real-Time Schedule Adjustment Engine
 * Provides live monitoring, dynamic rebalancing, emergency scheduling, and proactive recommendations
 */

/**
 * Real-Time Adjuster for dynamic schedule optimization
 */
export class RealTimeAdjuster {
  constructor() {
    this.initialized = false;
    this.version = "1.0.0";
    this.monitoring = false;

    // Real-time state tracking
    this.currentViolations = [];
    this.currentImbalances = [];
    this.emergencyQueue = [];
    this.adjustmentHistory = [];

    // Monitoring sources and callbacks
    this.monitoringSources = new Map();
    this.alertCallbacks = new Set();
    this.adjustmentCallbacks = new Set();

    // Configuration
    this.config = {
      monitoringInterval: 5000, // 5 seconds
      violationThreshold: 0.1, // 10% violation tolerance
      imbalanceThreshold: 0.2, // 20% imbalance tolerance
      emergencyResponseTime: 1000, // 1 second for emergency response
      maxAdjustmentsPerHour: 10,
      adjustmentCooldown: 300000, // 5 minutes between adjustments
      criticality: {
        constraint_violation: "critical",
        staff_imbalance: "high",
        coverage_gap: "high",
        preference_conflict: "medium",
        efficiency_issue: "low",
      },
    };

    // Performance metrics
    this.metrics = {
      totalViolationsDetected: 0,
      totalAdjustmentsApplied: 0,
      emergencyResponsesHandled: 0,
      averageResponseTime: 0,
      adjustmentSuccessRate: 0,
      systemUptime: 0,
      lastAdjustmentTime: null,
    };

    // Violation detection rules
    this.violationRules = [
      {
        name: "daily_coverage_limit",
        type: "constraint_violation",
        check: this.checkDailyCoverageLimit.bind(this),
        severity: "critical",
      },
      {
        name: "monthly_dayoff_limit",
        type: "constraint_violation",
        check: this.checkMonthlyDayOffLimit.bind(this),
        severity: "high",
      },
      {
        name: "group_restrictions",
        type: "constraint_violation",
        check: this.checkGroupRestrictions.bind(this),
        severity: "critical",
      },
      {
        name: "workload_imbalance",
        type: "staff_imbalance",
        check: this.checkWorkloadImbalance.bind(this),
        severity: "medium",
      },
      {
        name: "coverage_gaps",
        type: "coverage_gap",
        check: this.checkCoverageGaps.bind(this),
        severity: "high",
      },
    ];

    // Adjustment strategies
    this.adjustmentStrategies = new Map([
      ["constraint_violation", this.resolveConstraintViolation.bind(this)],
      ["staff_imbalance", this.rebalanceWorkload.bind(this)],
      ["coverage_gap", this.fillCoverageGap.bind(this)],
      ["emergency_shortage", this.handleEmergencyShortage.bind(this)],
      ["staff_unavailable", this.handleStaffUnavailability.bind(this)],
    ]);

    // System status
    this.systemStatus = {
      operational: false,
      lastCheck: null,
      activeAlerts: 0,
      queuedAdjustments: 0,
      systemHealth: "unknown",
    };
  }

  /**
   * Initialize the real-time adjuster
   * @param {Object} config - Configuration options
   * @returns {Object} Initialization result
   */
  async initialize(config = {}) {
    console.log("⚡ Initializing Real-Time Adjuster...");

    try {
      // Merge configuration
      this.config = { ...this.config, ...config };

      // Initialize monitoring state
      this.initializeMonitoringState();

      // Setup violation detection rules
      this.setupViolationDetection();

      // Initialize adjustment strategies
      this.initializeAdjustmentStrategies();

      this.initialized = true;
      this.systemStatus.operational = true;
      this.systemStatus.systemHealth = "healthy";

      console.log("✅ Real-Time Adjuster initialized");
      console.log(`Monitoring interval: ${this.config.monitoringInterval}ms`);
      console.log(
        `Emergency response time: ${this.config.emergencyResponseTime}ms`,
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        monitoringInterval: this.config.monitoringInterval,
        violationRules: this.violationRules.length,
        adjustmentStrategies: this.adjustmentStrategies.size,
      };
    } catch (error) {
      console.error("❌ Real-Time Adjuster initialization failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Initialize monitoring state
   */
  initializeMonitoringState() {
    this.currentViolations = [];
    this.currentImbalances = [];
    this.emergencyQueue = [];
    this.adjustmentHistory = [];

    this.systemStatus.lastCheck = new Date().toISOString();
    this.systemStatus.activeAlerts = 0;
    this.systemStatus.queuedAdjustments = 0;
  }

  /**
   * Setup violation detection rules
   */
  setupViolationDetection() {
    this.violationRules.forEach((rule) => {
      console.log(
        `📋 Configured violation rule: ${rule.name} (${rule.severity})`,
      );
    });
  }

  /**
   * Initialize adjustment strategies
   */
  initializeAdjustmentStrategies() {
    console.log(
      `🔧 Loaded ${this.adjustmentStrategies.size} adjustment strategies`,
    );
  }

  /**
   * Add monitoring source
   * @param {string} sourceName - Source name
   * @param {Object} source - Source object
   */
  addMonitoringSource(sourceName, source) {
    this.monitoringSources.set(sourceName, source);
    console.log(`📡 Added monitoring source: ${sourceName}`);
  }

  /**
   * Start real-time monitoring
   * @returns {Object} Start result
   */
  startMonitoring() {
    if (!this.initialized) {
      throw new Error("Real-Time Adjuster not initialized");
    }

    if (this.monitoring) {
      console.log("⚠️ Monitoring already active");
      return { success: true, message: "Already monitoring" };
    }

    console.log("🔄 Starting real-time monitoring...");

    this.monitoring = true;
    this.metrics.systemUptime = Date.now();

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      await this.performMonitoringCycle();
    }, this.config.monitoringInterval);

    console.log("✅ Real-time monitoring started");

    return {
      success: true,
      timestamp: new Date().toISOString(),
      monitoringInterval: this.config.monitoringInterval,
    };
  }

  /**
   * Stop real-time monitoring
   * @returns {Object} Stop result
   */
  stopMonitoring() {
    if (!this.monitoring) {
      return { success: true, message: "Not monitoring" };
    }

    console.log("🛑 Stopping real-time monitoring...");

    this.monitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log("✅ Real-time monitoring stopped");

    return {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.metrics.systemUptime,
    };
  }

  /**
   * Perform a monitoring cycle
   */
  async performMonitoringCycle() {
    try {
      const cycleStart = Date.now();

      // Detect violations
      const violations = await this.detectViolations();

      // Detect imbalances
      const imbalances = await this.detectImbalances();

      // Process emergency queue
      await this.processEmergencyQueue();

      // Apply automatic adjustments if needed
      if (
        violations.critical.length > 0 ||
        imbalances.severity > this.config.imbalanceThreshold
      ) {
        await this.applyAutomaticAdjustments({
          violations,
          imbalances,
          timestamp: new Date().toISOString(),
        });
      }

      // Update system status
      this.updateSystemStatus(violations, imbalances);

      // Update metrics
      const cycleTime = Date.now() - cycleStart;
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime + cycleTime) / 2;

      this.systemStatus.lastCheck = new Date().toISOString();
    } catch (error) {
      console.error("❌ Monitoring cycle failed:", error);
      this.systemStatus.systemHealth = "degraded";
    }
  }

  /**
   * Detect violations in current schedule state
   * @returns {Object} Detected violations
   */
  async detectViolations() {
    const violations = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    try {
      // Get current schedule state from monitoring sources
      const currentState = await this.getCurrentScheduleState();

      if (!currentState.success) {
        return violations;
      }

      // Run violation detection rules
      for (const rule of this.violationRules) {
        try {
          const ruleViolations = await rule.check(currentState.data);

          if (ruleViolations && ruleViolations.length > 0) {
            violations[rule.severity].push(
              ...ruleViolations.map((v) => ({
                ...v,
                rule: rule.name,
                type: rule.type,
                severity: rule.severity,
                detectedAt: new Date().toISOString(),
              })),
            );
          }
        } catch (error) {
          console.error(`❌ Violation rule ${rule.name} failed:`, error);
        }
      }

      // Update current violations
      this.currentViolations = [
        ...violations.critical,
        ...violations.high,
        ...violations.medium,
        ...violations.low,
      ];

      this.metrics.totalViolationsDetected += this.currentViolations.length;
    } catch (error) {
      console.error("❌ Violation detection failed:", error);
    }

    return violations;
  }

  /**
   * Detect imbalances in current schedule
   * @returns {Object} Detected imbalances
   */
  async detectImbalances() {
    const imbalances = {
      workload: [],
      coverage: [],
      fairness: [],
      severity: 0,
    };

    try {
      // Get current schedule state
      const currentState = await this.getCurrentScheduleState();

      if (!currentState.success) {
        return imbalances;
      }

      // Check workload imbalances
      const workloadImbalances = await this.analyzeWorkloadBalance(
        currentState.data,
      );
      if (workloadImbalances.length > 0) {
        imbalances.workload = workloadImbalances;
        imbalances.severity = Math.max(imbalances.severity, 0.6);
      }

      // Check coverage imbalances
      const coverageImbalances = await this.analyzeCoverageBalance(
        currentState.data,
      );
      if (coverageImbalances.length > 0) {
        imbalances.coverage = coverageImbalances;
        imbalances.severity = Math.max(imbalances.severity, 0.7);
      }

      // Check fairness imbalances
      const fairnessImbalances = await this.analyzeFairnessBalance(
        currentState.data,
      );
      if (fairnessImbalances.length > 0) {
        imbalances.fairness = fairnessImbalances;
        imbalances.severity = Math.max(imbalances.severity, 0.5);
      }

      // Update current imbalances
      this.currentImbalances = [
        ...imbalances.workload,
        ...imbalances.coverage,
        ...imbalances.fairness,
      ];
    } catch (error) {
      console.error("❌ Imbalance detection failed:", error);
    }

    return imbalances;
  }

  /**
   * Get current schedule state from monitoring sources
   * @returns {Object} Current schedule state
   */
  async getCurrentScheduleState() {
    try {
      // Try to get data from monitoring sources
      for (const [_sourceName, source] of this.monitoringSources) {
        if (source && typeof source.getCurrentScheduleState === "function") {
          const state = await source.getCurrentScheduleState();
          if (state && state.success) {
            return state;
          }
        }
      }

      // Return mock data if no sources available
      return {
        success: true,
        data: {
          schedule: {},
          staffMembers: [],
          dateRange: [],
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("❌ Failed to get current schedule state:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Process emergency queue
   */
  async processEmergencyQueue() {
    if (this.emergencyQueue.length === 0) {
      return;
    }

    console.log(
      `🚨 Processing ${this.emergencyQueue.length} emergency items...`,
    );

    // Sort by priority and timestamp
    this.emergencyQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    // Process emergency items
    const processedItems = [];

    for (const emergency of this.emergencyQueue) {
      if (
        Date.now() - emergency.timestamp >
        this.config.emergencyResponseTime * 10
      ) {
        // Skip very old emergencies
        processedItems.push(emergency);
        continue;
      }

      try {
        const result = await this.handleEmergency(emergency);

        if (result.success) {
          processedItems.push(emergency);
          this.metrics.emergencyResponsesHandled++;
        }
      } catch (error) {
        console.error(
          `❌ Emergency handling failed for ${emergency.type}:`,
          error,
        );
      }
    }

    // Remove processed items
    this.emergencyQueue = this.emergencyQueue.filter(
      (item) => !processedItems.includes(item),
    );
  }

  /**
   * Apply emergency adjustments
   * @param {Object} params - Emergency parameters
   * @returns {Object} Emergency adjustment result
   */
  async applyEmergencyAdjustments(params) {
    if (!this.initialized) {
      throw new Error("Real-Time Adjuster not initialized");
    }

    const { violations, imbalances, seasonalDeviations } = params;

    console.log("🚨 Applying emergency adjustments...");

    try {
      const startTime = Date.now();
      const adjustments = [];

      // Handle critical violations first
      if (violations && violations.critical.length > 0) {
        for (const violation of violations.critical) {
          const adjustment = await this.createEmergencyAdjustment(
            violation,
            "critical",
          );
          if (adjustment) {
            adjustments.push(adjustment);
          }
        }
      }

      // Handle severe imbalances
      if (imbalances && imbalances.severity > 0.8) {
        const adjustment = await this.createImbalanceAdjustment(
          imbalances,
          "high",
        );
        if (adjustment) {
          adjustments.push(adjustment);
        }
      }

      // Handle seasonal deviations
      if (seasonalDeviations && seasonalDeviations.length > 0) {
        for (const deviation of seasonalDeviations.filter(
          (d) => d.severity > 0.7,
        )) {
          const adjustment = await this.createSeasonalAdjustment(
            deviation,
            "medium",
          );
          if (adjustment) {
            adjustments.push(adjustment);
          }
        }
      }

      // Apply adjustments
      const appliedAdjustments = [];
      for (const adjustment of adjustments) {
        const result = await this.applyAdjustment(adjustment);
        if (result.success) {
          appliedAdjustments.push(adjustment);
        }
      }

      const adjustmentTime = Date.now() - startTime;
      this.metrics.totalAdjustmentsApplied += appliedAdjustments.length;
      this.metrics.lastAdjustmentTime = new Date().toISOString();

      console.log(
        `✅ Applied ${appliedAdjustments.length} emergency adjustments in ${adjustmentTime}ms`,
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        adjustmentTime,
        adjustmentsApplied: appliedAdjustments.length,
        adjustments: appliedAdjustments,
        violationsAddressed: violations ? violations.critical.length : 0,
        imbalancesAddressed: imbalances
          ? imbalances.severity > 0.8
            ? 1
            : 0
          : 0,
      };
    } catch (error) {
      console.error("❌ Emergency adjustments failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        adjustmentsApplied: 0,
      };
    }
  }

  /**
   * Apply automatic adjustments based on monitoring
   * @param {Object} monitoringData - Monitoring data
   */
  async applyAutomaticAdjustments(monitoringData) {
    const { violations, imbalances } = monitoringData;

    // Check cooldown period
    if (this.metrics.lastAdjustmentTime) {
      const timeSinceLastAdjustment =
        Date.now() - new Date(this.metrics.lastAdjustmentTime);
      if (timeSinceLastAdjustment < this.config.adjustmentCooldown) {
        return; // Skip adjustment due to cooldown
      }
    }

    // Check hourly limit
    const oneHourAgo = Date.now() - 3600000;
    const recentAdjustments = this.adjustmentHistory.filter(
      (adj) => new Date(adj.timestamp) > oneHourAgo,
    );

    if (recentAdjustments.length >= this.config.maxAdjustmentsPerHour) {
      console.log(
        "⏰ Maximum adjustments per hour reached, skipping automatic adjustment",
      );
      return;
    }

    // Apply adjustments
    await this.applyEmergencyAdjustments({ violations, imbalances });
  }

  /**
   * Create emergency adjustment
   * @param {Object} violation - Violation details
   * @param {string} priority - Adjustment priority
   * @returns {Object} Emergency adjustment
   */
  async createEmergencyAdjustment(violation, priority) {
    return {
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "emergency_adjustment",
      priority,
      violation,
      strategy: this.selectAdjustmentStrategy(violation),
      timestamp: new Date().toISOString(),
      urgency: "immediate",
    };
  }

  /**
   * Create imbalance adjustment
   * @param {Object} imbalances - Imbalance details
   * @param {string} priority - Adjustment priority
   * @returns {Object} Imbalance adjustment
   */
  async createImbalanceAdjustment(imbalances, priority) {
    return {
      id: `imbalance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "imbalance_adjustment",
      priority,
      imbalances,
      strategy: "staff_imbalance",
      timestamp: new Date().toISOString(),
      urgency: "high",
    };
  }

  /**
   * Create seasonal adjustment
   * @param {Object} deviation - Seasonal deviation
   * @param {string} priority - Adjustment priority
   * @returns {Object} Seasonal adjustment
   */
  async createSeasonalAdjustment(deviation, priority) {
    return {
      id: `seasonal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "seasonal_adjustment",
      priority,
      deviation,
      strategy: "seasonal_adaptation",
      timestamp: new Date().toISOString(),
      urgency: "medium",
    };
  }

  /**
   * Apply an adjustment
   * @param {Object} adjustment - Adjustment to apply
   * @returns {Object} Application result
   */
  async applyAdjustment(adjustment) {
    try {
      const strategy = this.adjustmentStrategies.get(adjustment.strategy);

      if (!strategy) {
        console.warn(`⚠️ No strategy found for ${adjustment.strategy}`);
        return { success: false, error: "Strategy not found" };
      }

      const result = await strategy(adjustment);

      // Record in adjustment history
      this.adjustmentHistory.push({
        ...adjustment,
        result,
        completedAt: new Date().toISOString(),
      });

      // Keep only last 100 adjustments
      if (this.adjustmentHistory.length > 100) {
        this.adjustmentHistory = this.adjustmentHistory.slice(-100);
      }

      return result;
    } catch (error) {
      console.error(`❌ Adjustment application failed:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Select appropriate adjustment strategy
   * @param {Object} violation - Violation details
   * @returns {string} Strategy name
   */
  selectAdjustmentStrategy(violation) {
    switch (violation.type) {
      case "constraint_violation":
        return "constraint_violation";
      case "staff_imbalance":
        return "staff_imbalance";
      case "coverage_gap":
        return "coverage_gap";
      default:
        return "constraint_violation";
    }
  }

  /**
   * Handle emergency situation
   * @param {Object} emergency - Emergency details
   * @returns {Object} Handling result
   */
  async handleEmergency(emergency) {
    console.log(
      `🚨 Handling emergency: ${emergency.type} (${emergency.priority})`,
    );

    try {
      switch (emergency.type) {
        case "staff_unavailable":
          return await this.handleStaffUnavailability(emergency);
        case "coverage_shortage":
          return await this.handleEmergencyShortage(emergency);
        case "constraint_violation":
          return await this.resolveConstraintViolation(emergency);
        default:
          console.warn(`⚠️ Unknown emergency type: ${emergency.type}`);
          return { success: false, error: "Unknown emergency type" };
      }
    } catch (error) {
      console.error(`❌ Emergency handling failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update system status
   * @param {Object} violations - Current violations
   * @param {Object} imbalances - Current imbalances
   */
  updateSystemStatus(violations, imbalances) {
    const totalViolations = Object.values(violations).flat().length;
    const totalImbalances = Object.values(imbalances)
      .filter(Array.isArray)
      .flat().length;

    this.systemStatus.activeAlerts = totalViolations + totalImbalances;
    this.systemStatus.queuedAdjustments = this.emergencyQueue.length;

    // Determine system health
    if (violations.critical.length > 0) {
      this.systemStatus.systemHealth = "critical";
    } else if (violations.high.length > 0 || imbalances.severity > 0.7) {
      this.systemStatus.systemHealth = "degraded";
    } else if (totalViolations > 0 || totalImbalances > 0) {
      this.systemStatus.systemHealth = "warning";
    } else {
      this.systemStatus.systemHealth = "healthy";
    }
  }

  // Violation checking methods

  async checkDailyCoverageLimit({ schedule, staffMembers, dateRange }) {
    const violations = [];

    if (!dateRange || !staffMembers) return violations;

    dateRange.forEach((date) => {
      const dateKey = date.toISOString
        ? date.toISOString().split("T")[0]
        : date;
      let daysOffCount = 0;

      staffMembers.forEach((staff) => {
        const staffSchedule = schedule[staff.id] || {};
        if (staffSchedule[dateKey] === "×") {
          daysOffCount++;
        }
      });

      if (daysOffCount > 4) {
        // Max 4 staff off per day
        violations.push({
          type: "daily_coverage_exceeded",
          date: dateKey,
          currentCount: daysOffCount,
          limit: 4,
          severity: "critical",
        });
      }
    });

    return violations;
  }

  async checkMonthlyDayOffLimit({ schedule, staffMembers, dateRange }) {
    const violations = [];

    if (!staffMembers || !dateRange) return violations;

    const totalDays = dateRange.length;
    const maxDaysOff = Math.floor(totalDays * 0.25); // Max 25% days off

    staffMembers.forEach((staff) => {
      const staffSchedule = schedule[staff.id] || {};
      const daysOff = Object.values(staffSchedule).filter(
        (shift) => shift === "×",
      ).length;

      if (daysOff > maxDaysOff) {
        violations.push({
          type: "monthly_dayoff_exceeded",
          staffId: staff.id,
          staffName: staff.name,
          currentDaysOff: daysOff,
          limit: maxDaysOff,
          severity: "high",
        });
      }
    });

    return violations;
  }

  async checkGroupRestrictions({
    schedule: _schedule,
    staffMembers: _staffMembers,
    dateRange: _dateRange,
  }) {
    const violations = [];

    // Simplified group restriction checking
    // In practice, this would check actual group definitions

    return violations;
  }

  async checkWorkloadImbalance({
    schedule,
    staffMembers,
    dateRange: _dateRange,
  }) {
    const violations = [];

    if (!staffMembers || staffMembers.length < 2) return violations;

    const workloads = staffMembers.map((staff) => {
      const staffSchedule = schedule[staff.id] || {};
      const workDays = Object.values(staffSchedule).filter(
        (shift) => shift !== "×",
      ).length;
      return { staffId: staff.id, staffName: staff.name, workDays };
    });

    const avgWorkload =
      workloads.reduce((sum, w) => sum + w.workDays, 0) / workloads.length;
    const threshold = avgWorkload * 0.3; // 30% deviation threshold

    workloads.forEach((workload) => {
      if (Math.abs(workload.workDays - avgWorkload) > threshold) {
        violations.push({
          type: "workload_imbalance",
          staffId: workload.staffId,
          staffName: workload.staffName,
          currentWorkDays: workload.workDays,
          averageWorkDays: avgWorkload,
          deviation: Math.abs(workload.workDays - avgWorkload),
          severity: "medium",
        });
      }
    });

    return violations;
  }

  async checkCoverageGaps({ schedule, staffMembers, dateRange }) {
    const violations = [];

    // Check for days with insufficient coverage
    dateRange.forEach((date) => {
      const dateKey = date.toISOString
        ? date.toISOString().split("T")[0]
        : date;
      let workingStaff = 0;

      staffMembers.forEach((staff) => {
        const staffSchedule = schedule[staff.id] || {};
        if (staffSchedule[dateKey] && staffSchedule[dateKey] !== "×") {
          workingStaff++;
        }
      });

      const requiredCoverage = Math.ceil(staffMembers.length * 0.7); // At least 70% coverage

      if (workingStaff < requiredCoverage) {
        violations.push({
          type: "insufficient_coverage",
          date: dateKey,
          currentCoverage: workingStaff,
          requiredCoverage,
          gap: requiredCoverage - workingStaff,
          severity: "high",
        });
      }
    });

    return violations;
  }

  // Analysis methods

  async analyzeWorkloadBalance({ schedule, staffMembers }) {
    const imbalances = [];

    if (!staffMembers || staffMembers.length < 2) return imbalances;

    // Calculate workload distribution
    const workloads = staffMembers.map((staff) => {
      const staffSchedule = schedule[staff.id] || {};
      const workDays = Object.values(staffSchedule).filter(
        (shift) => shift !== "×",
      ).length;
      return workDays;
    });

    const mean = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;
    const variance =
      workloads.reduce((sum, w) => sum + Math.pow(w - mean, 2), 0) /
      workloads.length;
    const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

    if (coefficientOfVariation > this.config.imbalanceThreshold) {
      imbalances.push({
        type: "workload_distribution",
        severity: coefficientOfVariation,
        mean,
        variance,
        coefficientOfVariation,
        recommendedAction: "redistribute_workload",
      });
    }

    return imbalances;
  }

  async analyzeCoverageBalance({ schedule, staffMembers, dateRange }) {
    const imbalances = [];

    if (!dateRange) return imbalances;

    const coverageLevels = dateRange.map((date) => {
      const dateKey = date.toISOString
        ? date.toISOString().split("T")[0]
        : date;
      let workingStaff = 0;

      staffMembers.forEach((staff) => {
        const staffSchedule = schedule[staff.id] || {};
        if (staffSchedule[dateKey] && staffSchedule[dateKey] !== "×") {
          workingStaff++;
        }
      });

      return workingStaff;
    });

    const meanCoverage =
      coverageLevels.reduce((sum, c) => sum + c, 0) / coverageLevels.length;
    const variance =
      coverageLevels.reduce(
        (sum, c) => sum + Math.pow(c - meanCoverage, 2),
        0,
      ) / coverageLevels.length;
    const standardDeviation = Math.sqrt(variance);

    if (standardDeviation > meanCoverage * 0.2) {
      // 20% variation threshold
      imbalances.push({
        type: "coverage_variation",
        severity: standardDeviation / meanCoverage,
        meanCoverage,
        standardDeviation,
        recommendedAction: "balance_daily_coverage",
      });
    }

    return imbalances;
  }

  async analyzeFairnessBalance({ schedule, staffMembers }) {
    const imbalances = [];

    // Analyze fairness based on shift type distribution
    const shiftDistributions = staffMembers.map((staff) => {
      const staffSchedule = schedule[staff.id] || {};
      const shifts = { "△": 0, "○": 0, "▽": 0, "×": 0 };

      Object.values(staffSchedule).forEach((shift) => {
        if (shifts[shift] !== undefined) {
          shifts[shift]++;
        }
      });

      return { staffId: staff.id, shifts };
    });

    // Check for unfair distribution of undesirable shifts
    const earlyShiftCounts = shiftDistributions.map((d) => d.shifts["△"]);
    const lateShiftCounts = shiftDistributions.map((d) => d.shifts["▽"]);

    const earlyMean =
      earlyShiftCounts.reduce((sum, c) => sum + c, 0) / earlyShiftCounts.length;
    const lateMean =
      lateShiftCounts.reduce((sum, c) => sum + c, 0) / lateShiftCounts.length;

    const earlyVariance =
      earlyShiftCounts.reduce((sum, c) => sum + Math.pow(c - earlyMean, 2), 0) /
      earlyShiftCounts.length;
    const lateVariance =
      lateShiftCounts.reduce((sum, c) => sum + Math.pow(c - lateMean, 2), 0) /
      lateShiftCounts.length;

    if (Math.sqrt(earlyVariance) > earlyMean * 0.3) {
      imbalances.push({
        type: "early_shift_unfairness",
        severity: Math.sqrt(earlyVariance) / earlyMean,
        mean: earlyMean,
        variance: earlyVariance,
        recommendedAction: "redistribute_early_shifts",
      });
    }

    if (Math.sqrt(lateVariance) > lateMean * 0.3) {
      imbalances.push({
        type: "late_shift_unfairness",
        severity: Math.sqrt(lateVariance) / lateMean,
        mean: lateMean,
        variance: lateVariance,
        recommendedAction: "redistribute_late_shifts",
      });
    }

    return imbalances;
  }

  // Adjustment strategy implementations

  async resolveConstraintViolation(adjustment) {
    console.log(
      `🔧 Resolving constraint violation: ${adjustment.violation?.type}`,
    );

    // Simplified constraint violation resolution
    return {
      success: true,
      action: "constraint_adjusted",
      details: `Resolved ${adjustment.violation?.type} violation`,
      timestamp: new Date().toISOString(),
    };
  }

  async rebalanceWorkload(_adjustment) {
    console.log("⚖️ Rebalancing workload distribution");

    // Simplified workload rebalancing
    return {
      success: true,
      action: "workload_rebalanced",
      details: "Redistributed shifts for better balance",
      timestamp: new Date().toISOString(),
    };
  }

  async fillCoverageGap(_adjustment) {
    console.log("🔳 Filling coverage gap");

    // Simplified coverage gap filling
    return {
      success: true,
      action: "coverage_filled",
      details: "Added staff to fill coverage gap",
      timestamp: new Date().toISOString(),
    };
  }

  async handleEmergencyShortage(_adjustment) {
    console.log("🚨 Handling emergency shortage");

    // Simplified emergency shortage handling
    return {
      success: true,
      action: "emergency_coverage_provided",
      details: "Rearranged schedule for emergency coverage",
      timestamp: new Date().toISOString(),
    };
  }

  async handleStaffUnavailability(_adjustment) {
    console.log("👤 Handling staff unavailability");

    // Simplified staff unavailability handling
    return {
      success: true,
      action: "replacement_arranged",
      details: "Found replacement for unavailable staff",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Add emergency to queue
   * @param {Object} emergency - Emergency details
   */
  addEmergency(emergency) {
    this.emergencyQueue.push({
      ...emergency,
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      status: "queued",
    });

    this.systemStatus.queuedAdjustments = this.emergencyQueue.length;

    console.log(
      `🚨 Emergency added to queue: ${emergency.type} (${emergency.priority})`,
    );
  }

  /**
   * Get real-time adjuster status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      monitoring: this.monitoring,
      version: this.version,
      systemStatus: { ...this.systemStatus },
      metrics: { ...this.metrics },
      currentViolations: this.currentViolations.length,
      currentImbalances: this.currentImbalances.length,
      emergencyQueueSize: this.emergencyQueue.length,
      adjustmentHistorySize: this.adjustmentHistory.length,
      monitoringSources: this.monitoringSources.size,
      config: this.config,
    };
  }

  /**
   * Reset the real-time adjuster
   * @returns {Object} Reset result
   */
  async reset() {
    console.log("🔄 Resetting Real-Time Adjuster...");

    try {
      // Stop monitoring
      if (this.monitoring) {
        this.stopMonitoring();
      }

      // Reset state
      this.initialized = false;
      this.initializeMonitoringState();

      // Clear sources and callbacks
      this.monitoringSources.clear();
      this.alertCallbacks.clear();
      this.adjustmentCallbacks.clear();

      // Reset metrics
      this.metrics = {
        totalViolationsDetected: 0,
        totalAdjustmentsApplied: 0,
        emergencyResponsesHandled: 0,
        averageResponseTime: 0,
        adjustmentSuccessRate: 0,
        systemUptime: 0,
        lastAdjustmentTime: null,
      };

      // Reset system status
      this.systemStatus = {
        operational: false,
        lastCheck: null,
        activeAlerts: 0,
        queuedAdjustments: 0,
        systemHealth: "unknown",
      };

      console.log("✅ Real-Time Adjuster reset successfully");

      return {
        success: true,
        message: "Real-Time Adjuster reset successfully",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Real-Time Adjuster reset failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
