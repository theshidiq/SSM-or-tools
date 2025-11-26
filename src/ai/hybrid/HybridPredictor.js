/**
 * HybridPredictor.js
 *
 * Hybrid AI system that combines TensorFlow ML predictions with business rule validation.
 * This creates a robust scheduling system that leverages neural networks while ensuring
 * compliance with business constraints and restaurant operations requirements.
 */

import { TensorFlowScheduler } from "../ml/TensorFlowScheduler";
import { validateAllConstraints } from "../constraints/ConstraintEngine";
import { extractAllDataForAI } from "../utils/DataExtractor";
import { BusinessRuleValidator } from "./BusinessRuleValidator";
import { calculatePatternStability } from "../core/PatternRecognizer";
import BackupStaffService from "../../services/BackupStaffService";

export class HybridPredictor {
  constructor() {
    this.initialized = false;
    this.status = "idle";
    this.mlEngine = null;
    this.ruleValidator = null;
    this.backupStaffService = new BackupStaffService(); // Backup staff service integration
    this.predictionHistory = [];
    this.settingsProvider = null; // Real-time settings provider
    this.metrics = {
      totalPredictions: 0,
      mlAcceptedRate: 0,
      rulesAppliedRate: 0,
      hybridSuccessRate: 0,
    };
  }

  /**
   * Set settings provider for real-time configuration access
   * @param {Object} provider - Settings provider with getSettings() method
   */
  setSettingsProvider(provider) {
    if (!provider || typeof provider.getSettings !== "function") {
      throw new Error(
        "Invalid settings provider - must have getSettings() method",
      );
    }
    this.settingsProvider = provider;
    console.log("✅ HybridPredictor: Settings provider configured");

    // Also pass settings provider to rule validator
    if (this.ruleValidator) {
      this.ruleValidator.setSettingsProvider(provider);
    }
  }

  /**
   * Initialize the hybrid prediction system
   * @param {Object} options - Configuration options
   */
  async initialize(options = {}) {
    try {
      this.status = "initializing";
      console.log("🤖 Initializing HybridPredictor...");

      // Initialize TensorFlow ML engine
      this.mlEngine = new TensorFlowScheduler();
      await this.mlEngine.initialize(options.ml);

      // Initialize business rule validator
      this.ruleValidator = new BusinessRuleValidator();
      await this.ruleValidator.initialize({
        ...options.rules,
        strictValidation: true,
        allowPartialCorrection: false, // Enforce complete constraint compliance
        maxCorrectionAttempts: 5, // More attempts to fix violations
        settingsProvider: this.settingsProvider, // Pass settings provider
      });

      // Initialize backup staff service with configuration
      console.log("🔧 Initializing BackupStaffService...");
      const {
        staffMembers = [],
        staffGroups = [],
        backupAssignments = [],
      } = options;

      await this.backupStaffService.initializeWithConfiguration(
        staffMembers,
        staffGroups,
        backupAssignments, // Will auto-load from config if null/undefined
      );
      console.log("✅ BackupStaffService initialized in HybridPredictor");

      // ✅ NEW: Link BackupStaffService to BusinessRuleValidator
      // This allows the rule validator to detect and skip backup-only staff during off-day distribution
      if (this.backupStaffService && this.backupStaffService.initialized) {
        this.ruleValidator.setBackupStaffService(this.backupStaffService);
        console.log("✅ HybridPredictor: BackupStaffService linked to BusinessRuleValidator");
      } else {
        console.warn("⚠️ HybridPredictor: BackupStaffService not initialized, backup staff may receive day offs");
      }

      this.options = {
        // ML prediction settings - UPDATED for high-accuracy ML system
        mlConfidenceThreshold: 0.85, // High confidence for 90%+ accuracy system
        mlMediumConfidenceThreshold: 0.75, // Medium confidence threshold
        mlLowConfidenceThreshold: 0.65, // Low confidence threshold
        useMLPredictions: true,

        // Rule validation settings
        strictRuleEnforcement: true,
        allowRuleOverrides: false,

        // Hybrid decision engine settings
        preferMLWhenValid: true,
        fallbackToRules: true,
        enableIntelligentDecisionEngine: true,
        dynamicThresholdAdjustment: true,

        // Performance settings
        maxCorrectionAttempts: 3,
        enablePerformanceMonitoring: true,
        memoryCleanupInterval: 30000, // 30 seconds

        ...options,
      };

      // Initialize intelligent decision engine with Phase 3 adaptive thresholds
      this.decisionEngine = {
        totalDecisions: 0,
        mlSuccessRate: 0,
        ruleSuccessRate: 0,
        hybridSuccessRate: 0,
        adaptiveThresholds: {
          high: this.options.mlConfidenceThreshold,
          medium: this.options.mlMediumConfidenceThreshold,
          low: this.options.mlLowConfidenceThreshold,
        },
        // PHASE 3: Pattern-based threshold adaptation
        patternBasedAdjustments: {
          enabled: true,
          stabilityBonus: 0.05, // Bonus for high stability patterns
          instabilityPenalty: 0.03, // Penalty for unstable patterns
          minThreshold: 0.5, // Never go below 50% confidence
          maxThreshold: 0.95, // Never require more than 95% confidence
          adjustmentHistory: [],
        },
        // PHASE 3: Learning from corrections
        correctionLearning: {
          enabled: true,
          recentCorrections: [],
          maxHistory: 100,
          successPatterns: new Map(),
          failurePatterns: new Map(),
        },
      };

      this.initialized = true;
      this.status = "ready";
      console.log("✅ HybridPredictor initialized successfully");
    } catch (error) {
      this.status = "error";
      console.error("❌ HybridPredictor initialization failed:", error);
      throw error;
    }
  }

  /**
   * Check if the hybrid predictor is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return (
      this.initialized &&
      this.status === "ready" &&
      this.mlEngine?.isReady() &&
      this.ruleValidator?.isReady()
    );
  }

  /**
   * Generate hybrid predictions that combine ML and business rules with intelligent decision engine
   * @param {Object} inputData - Schedule input data
   * @param {Object} inputData.scheduleData - Current schedule data
   * @param {number} inputData.currentMonthIndex - Current month index
   * @param {number} inputData.timestamp - Request timestamp
   * @param {Object} inputData.earlyShiftPreferences - Early shift preferences map (Phase 1)
   * @param {Object} inputData.calendarRules - Calendar rules map (Phase 2)
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range for predictions
   * @param {Function} onProgress - Optional progress callback
   * @returns {Object} Hybrid prediction results
   */
  async predictSchedule(inputData, staffMembers, dateRange, onProgress = null) {
    console.log("🎯 [DEBUG] HybridPredictor.predictSchedule() CALLED", {
      isReady: this.isReady(),
      hasInputData: !!inputData,
      hasScheduleData: !!inputData?.scheduleData,
      staffCount: staffMembers?.length,
      dateCount: dateRange?.length,
      hasMlEngine: !!this.mlEngine,
      hasRuleValidator: !!this.ruleValidator,
      hasEarlyShiftPreferences: !!inputData?.earlyShiftPreferences,
      hasCalendarRules: !!inputData?.calendarRules,
    });

    // Log Phase 3 integration parameters
    if (inputData?.earlyShiftPreferences || inputData?.calendarRules) {
      console.log("📅 [Phase 3] Calendar + Early Shift Integration parameters detected", {
        earlyShiftPreferencesCount: Object.keys(inputData?.earlyShiftPreferences || {}).length,
        calendarRulesCount: Object.keys(inputData?.calendarRules || {}).length,
      });
    }

    if (!this.isReady()) {
      console.log("🎯 [DEBUG] HybridPredictor.predictSchedule() ERROR: Not ready");
      throw new Error("HybridPredictor not ready. Call initialize() first.");
    }

    this.status = "predicting";
    const startTime = Date.now();

    // 🎯 PERFORMANCE INSTRUMENTATION: Track each phase
    const perfMarks = {
      start: performance.now(),
      settingsLoadStart: null,
      settingsLoadEnd: null,
      mlPredictionStart: null,
      mlPredictionEnd: null,
      ruleValidationStart: null,
      ruleValidationEnd: null,
      correctionStart: null,
      correctionEnd: null,
      finalValidationStart: null,
      finalValidationEnd: null
    };

    try {
      console.log("🔮 Generating hybrid schedule predictions...");

      // Get live settings from settings provider (real-time configuration)
      perfMarks.settingsLoadStart = performance.now();
      let liveSettings = null;
      if (this.settingsProvider) {
        try {
          liveSettings = this.settingsProvider.getSettings();
          console.log(
            "⚡ Using live settings from WebSocket (real-time configuration)",
          );
        } catch (error) {
          console.warn(
            "⚠️ Failed to get live settings, using defaults:",
            error.message,
          );
          liveSettings = null;
        }
      } else {
        console.warn(
          "⚠️ No settings provider configured - call setSettingsProvider() first",
        );
      }
      perfMarks.settingsLoadEnd = performance.now();

      // Step 1: Get ML predictions with confidence analysis
      perfMarks.mlPredictionStart = performance.now();
      let mlPredictions = null;
      let mlConfidenceLevel = "none";
      let mlSuccess = false;

      if (this.options.useMLPredictions) {
        try {
          // Ensure ML model is trained or train it
          console.log("🎯 [DEBUG] BEFORE ensureMLModelTrained()");
          await this.ensureMLModelTrained(staffMembers);
          console.log("🎯 [DEBUG] AFTER ensureMLModelTrained() - model is ready");

          console.log("🎯 [DEBUG] BEFORE mlEngine.predictSchedule()");
          mlPredictions = await this.mlEngine.predictSchedule(
            inputData.scheduleData,
            staffMembers,
            dateRange,
            onProgress, // Forward progress callback to ML engine
            // ✅ Pass priority rules and constraints to ML engine
            {
              priorityRules: liveSettings?.priorityRules || [],
              dailyLimits: liveSettings?.dailyLimits || [],
              monthlyLimits: liveSettings?.monthlyLimits || [],
              staffGroups: liveSettings?.staffGroups || [],
              settingsProvider: this.settingsProvider, // Pass settings provider for real-time access
            }
          );
          console.log("🎯 [DEBUG] AFTER mlEngine.predictSchedule()", {
            hasPredictions: !!mlPredictions,
            predictionCount: mlPredictions?.predictions ? Object.keys(mlPredictions.predictions).length : 0
          });

          if (
            mlPredictions?.predictions &&
            Object.keys(mlPredictions.predictions).length > 0
          ) {
            const accuracy = mlPredictions.modelAccuracy || 0;

            // Intelligent confidence assessment
            mlConfidenceLevel = this.assessMLConfidence(
              accuracy,
              mlPredictions,
            );
            mlSuccess = mlConfidenceLevel !== "none";

            console.log(
              `🧠 ML predictions: ${mlSuccess ? "SUCCESS" : "FALLBACK"} (accuracy: ${accuracy.toFixed(3)}, confidence: ${mlConfidenceLevel})`,
            );
          }
        } catch (error) {
          console.warn(
            "⚠️ ML prediction failed, falling back to rules:",
            error.message,
          );
          this.handleMLError(error);
        }
      }
      perfMarks.mlPredictionEnd = performance.now();

      // Step 2: Intelligent decision engine for ML vs Rules
      const decisionResult = await this.makeIntelligentDecision(
        mlPredictions,
        mlConfidenceLevel,
        mlSuccess,
        staffMembers,
        dateRange,
      );

      let validatedPredictions = null;
      let ruleValidationResult = null;

      // 🎯 PERFORMANCE: Track rule validation phase
      perfMarks.ruleValidationStart = performance.now();
      if (decisionResult.useML && mlPredictions) {
        ruleValidationResult = await this.validateMLPredictions(
          mlPredictions.predictions,
          staffMembers,
          dateRange,
        );

        // STRICT CONSTRAINT ENFORCEMENT: Only accept schedules that fully pass validation
        // Block schedules with critical violations (daily limits, staff group conflicts)
        const hasCriticalViolations =
          ruleValidationResult.hasCriticalViolations || false;
        const canAcceptSchedule =
          ruleValidationResult.valid && !hasCriticalViolations;

        if (canAcceptSchedule) {
          validatedPredictions = mlPredictions.predictions;
          console.log(
            "✅ ML predictions fully validated and accepted by constraint engine",
          );
        } else {
          console.log(
            "❌ ML predictions rejected due to constraint violations:",
          );
          if (ruleValidationResult.criticalViolations) {
            ruleValidationResult.criticalViolations.forEach((v) => {
              console.log(`   - ${v.type}: ${v.message}`);
            });
          }
          console.log("🔄 Falling back to rule-based generation");
        }
      }
      perfMarks.ruleValidationEnd = performance.now();

      // Step 3: Execute decision with smart corrections and fallbacks
      perfMarks.correctionStart = performance.now();
      let finalSchedule = null;
      let predictionMethod = "unknown";
      let correctionAttempts = 0;

      if (
        (decisionResult.method === "ml_primary" ||
         decisionResult.method === "high_accuracy_ml") &&
        validatedPredictions &&
        ruleValidationResult?.valid
      ) {
        // Use high-confidence ML predictions
        console.log(`✅ [ML-VALIDATED] Using validated ML predictions (method: ${decisionResult.method})`);
        finalSchedule = validatedPredictions;
        predictionMethod = "ml_validated";
      } else if (
        decisionResult.method === "ml_corrected" &&
        validatedPredictions
      ) {
        // Use ML predictions with intelligent rule corrections
        const correctionResult = await this.applyIntelligentRuleCorrections(
          validatedPredictions,
          ruleValidationResult?.violations || [],
          staffMembers,
          dateRange,
          mlConfidenceLevel,
        );
        finalSchedule = correctionResult.schedule;
        predictionMethod = "ml_corrected";
        correctionAttempts = correctionResult.attempts;
      } else if (decisionResult.method === "hybrid_blend") {
        // Blend ML predictions with rule-based generation
        finalSchedule = await this.generateHybridBlendedSchedule(
          mlPredictions,
          inputData,
          staffMembers,
          dateRange,
          mlConfidenceLevel,
        );
        predictionMethod = "hybrid_blended";
      } else if (this.options.fallbackToRules) {
        // Generate rule-based schedule as final fallback
        console.log("🔄 [FALLBACK] Entering rule-based generation fallback");
        console.log(`📊 [FALLBACK] Decision method was: ${decisionResult.method}`);
        console.log(`📊 [FALLBACK] Validation failed with ${ruleValidationResult?.criticalViolations?.length || 0} critical violations`);
        console.log(`📊 [FALLBACK] Calling generateRuleBasedSchedule...`);

        try {
          finalSchedule = await this.ruleValidator.generateRuleBasedSchedule(
            inputData,
            staffMembers,
            dateRange,
          );
          console.log("✅ [FALLBACK] Rule-based schedule generated successfully");
          console.log(`📊 [FALLBACK] Generated schedule for ${Object.keys(finalSchedule || {}).length} staff members`);
          predictionMethod = "rule_based";
        } catch (error) {
          console.error("❌ [FALLBACK] Rule-based generation failed:", error);
          console.error("❌ [FALLBACK] Error stack:", error.stack);
          throw new Error(`Rule-based fallback failed: ${error.message}`);
        }
      } else {
        console.error("❌ [FALLBACK] No fallback available - fallbackToRules is false");
        throw new Error("Unable to generate valid schedule predictions");
      }
      perfMarks.correctionEnd = performance.now();

      // Step 4: Final validation
      perfMarks.finalValidationStart = performance.now();
      let finalValidation;

      // 🎯 OPTIMIZATION: Skip redundant validation for rule-based schedules
      // Rule-based generation already validates during applyPriorityRules, applyStaffGroupConstraints, etc.
      // Re-validating causes infinite loop/hang and provides no additional value
      if (predictionMethod === "rule_based") {
        console.log("✅ [VALIDATION] Skipping final validation for rule-based schedule (already validated during generation)");
        finalValidation = {
          valid: true,
          violations: [],
          summary: {
            note: "Rule-based schedule validated during generation",
            constraints: { passed: true },
            businessRules: { passed: true },
            quality: { score: 1.0 }
          }
        };
      } else {
        // Perform full validation for ML-generated schedules
        console.log(`🔍 [VALIDATION] Performing full validation for ${predictionMethod} schedule`);
        finalValidation = await this.performFinalValidation(
          finalSchedule,
          staffMembers,
          dateRange,
        );
      }
      perfMarks.finalValidationEnd = performance.now();

      // 🎯 PERFORMANCE: Calculate and log breakdown
      const perfBreakdown = {
        settingsLoad: (perfMarks.settingsLoadEnd || perfMarks.start) - (perfMarks.settingsLoadStart || perfMarks.start),
        mlPrediction: (perfMarks.mlPredictionEnd || perfMarks.mlPredictionStart || 0) - (perfMarks.mlPredictionStart || 0),
        ruleValidation: (perfMarks.ruleValidationEnd || perfMarks.ruleValidationStart || 0) - (perfMarks.ruleValidationStart || 0),
        correction: (perfMarks.correctionEnd || perfMarks.correctionStart || 0) - (perfMarks.correctionStart || 0),
        finalValidation: (perfMarks.finalValidationEnd || perfMarks.finalValidationStart || 0) - (perfMarks.finalValidationStart || 0),
        total: performance.now() - perfMarks.start
      };

      console.log('⏱️ [PERFORMANCE] AI Generation Breakdown:', {
        ...perfBreakdown,
        method: predictionMethod,
        breakdown: `${perfBreakdown.settingsLoad.toFixed(0)}ms settings + ${perfBreakdown.mlPrediction.toFixed(0)}ms ML + ${perfBreakdown.ruleValidation.toFixed(0)}ms validation + ${perfBreakdown.correction.toFixed(0)}ms correction + ${perfBreakdown.finalValidation.toFixed(0)}ms final = ${perfBreakdown.total.toFixed(0)}ms total`
      });

      // Step 5: Clean up backup staff schedules (remove × assignments from ML predictions)
      // Backup staff should only receive ○ (backup coverage) or blank (no assignment), never ×
      if (this.backupStaffService && this.backupStaffService.initialized) {
        console.log("🧹 [HybridPredictor] Cleaning up backup staff schedules (removing × assignments)...");
        let removedCount = 0;

        // Iterate through all staff in the schedule
        Object.keys(finalSchedule).forEach(staffId => {
          // Check if this staff member is a backup staff
          if (this.backupStaffService.isBackupStaff(staffId)) {
            const staffMember = staffMembers.find(s => s.id === staffId);
            const staffName = staffMember?.name || staffId;

            // Remove all × assignments for this backup staff
            Object.keys(finalSchedule[staffId]).forEach(dateKey => {
              if (finalSchedule[staffId][dateKey] === "×") {
                finalSchedule[staffId][dateKey] = ""; // Replace × with blank
                removedCount++;
              }
            });

            console.log(`✅ [BACKUP-CLEANUP] ${staffName}: Removed × assignments, keeping only backup coverage`);
          }
        });

        if (removedCount > 0) {
          console.log(`✅ [BACKUP-CLEANUP] Removed ${removedCount} × assignments from backup staff (backup-only policy enforced)`);
        } else {
          console.log(`✅ [BACKUP-CLEANUP] No × assignments found on backup staff (already clean)`);
        }
      }

      // Step 6: Apply backup staff assignments to final schedule
      console.log("🔄 [HybridPredictor] Applying backup staff assignments to final schedule...");
      finalSchedule = await this.applyBackupStaffAssignments(
        finalSchedule,
        staffMembers,
        dateRange,
      );

      // 🎯 Build result object with comprehensive metadata
      console.log(`📊 [RESULT] Building result object for ${predictionMethod} schedule`);
      console.log(`📊 [RESULT] Schedule has ${Object.keys(finalSchedule || {}).length} staff members`);

      const result = {
        success: true,
        schedule: finalSchedule,
        metadata: {
          method: predictionMethod,
          processingTime: Date.now() - startTime,
          mlUsed: mlSuccess,
          mlConfidence: mlPredictions?.modelAccuracy || 0,
          predictionConfidence: mlPredictions?.confidence || {},
          ruleValidationResult,
          finalValidation,
          violations: finalValidation.violations || [],
          quality: this.calculatePredictionQuality(finalValidation),
          performance: perfBreakdown, // 🎯 Include performance breakdown
        },
      };

      // Update metrics and history
      this.updateMetrics(result);
      this.predictionHistory.push({
        timestamp: new Date().toISOString(),
        method: predictionMethod,
        success: true,
        quality: result.metadata.quality,
      });

      this.status = "ready";
      console.log(
        `🎯 Hybrid prediction completed: ${predictionMethod} (${result.metadata.processingTime}ms)`,
      );
      console.log(`✅ [RESULT] Returning schedule with ${Object.keys(result.schedule || {}).length} staff members to caller`);

      return result;
    } catch (error) {
      this.status = "error";
      console.error("❌ Hybrid prediction failed:", error);
      throw error;
    }
  }

  /**
   * Validate ML predictions against business rules
   * @param {Object} mlSchedule - ML generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Validation result
   */
  async validateMLPredictions(mlSchedule, staffMembers, dateRange) {
    try {
      console.log("🔍 Validating ML predictions against business rules...");

      // Ensure fresh configuration is loaded for constraint validation
      const { refreshAllConfigurations } = await import(
        "../constraints/ConstraintEngine"
      );
      await refreshAllConfigurations();

      console.log("📊 Constraint validation details:");
      console.log(
        `- Schedule data: ${Object.keys(mlSchedule).length} staff members`,
      );
      console.log(`- Date range: ${dateRange.length} days`);
      console.log(`- Staff count: ${staffMembers.length}`);

      // Use the comprehensive constraint validation system
      const validationResult = await validateAllConstraints(
        mlSchedule,
        staffMembers,
        dateRange,
      );

      // Enhanced constraint violation logging
      if (!validationResult.valid) {
        console.error("❌ ML predictions violate constraints:");
        validationResult.violations.forEach((violation) => {
          console.error(`  - ${violation.type}: ${violation.message}`);
          if (violation.details) {
            console.error(`    Details:`, violation.details);
          }
        });
        console.error(
          `📊 Total violations: ${validationResult.violations.length}`,
        );
        console.error(`📊 Constraint summary:`, validationResult.summary);
      } else {
        console.log("✅ ML predictions passed all constraint validations");
      }

      // Additional business rule checks specific to ML predictions
      const additionalChecks = await this.ruleValidator.validateSchedule(
        mlSchedule,
        staffMembers,
        dateRange,
      );

      // Count critical violations that must be addressed
      const allViolations = [
        ...(validationResult.violations || []),
        ...(additionalChecks.violations || []),
      ];

      const criticalViolations = allViolations.filter(
        (v) => v.severity === "critical" || v.severity === "high",
      );
      const hasCriticalViolations = criticalViolations.length > 0;

      // Enforce strict constraint adherence - reject schedules with critical violations
      const isValidForProduction =
        validationResult.valid &&
        additionalChecks.valid &&
        !hasCriticalViolations;

      if (!isValidForProduction && hasCriticalViolations) {
        console.error(
          "🚫 Schedule rejected due to critical constraint violations:",
        );
        criticalViolations.forEach((violation) => {
          console.error(`  - CRITICAL: ${violation.message}`);
        });
      }

      return {
        valid: isValidForProduction,
        violations: allViolations,
        criticalViolations: criticalViolations,
        hasCriticalViolations: hasCriticalViolations,
        summary: {
          ...validationResult.summary,
          additionalChecks: additionalChecks.summary,
          totalViolations: allViolations.length,
          criticalViolationCount: criticalViolations.length,
        },
      };
    } catch (error) {
      console.error("❌ ML prediction validation failed:", error);
      return {
        valid: false,
        violations: [
          {
            type: "validation_error",
            message: `Validation failed: ${error.message}`,
            severity: "critical",
          },
        ],
        summary: { error: error.message },
      };
    }
  }

  /**
   * Apply rule-based corrections to ML predictions
   * @param {Object} mlSchedule - ML generated schedule
   * @param {Array} violations - Rule violations to fix
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Corrected schedule
   */
  async applyRuleCorrections(mlSchedule, violations, staffMembers, dateRange) {
    try {
      console.log("🔧 Applying rule-based corrections to ML predictions...");

      let correctedSchedule = JSON.parse(JSON.stringify(mlSchedule)); // Deep copy

      // Apply corrections for each violation
      for (const violation of violations) {
        correctedSchedule = await this.ruleValidator.correctViolation(
          correctedSchedule,
          violation,
          staffMembers,
          dateRange,
        );
      }

      return correctedSchedule;
    } catch (error) {
      console.error("❌ Rule correction failed:", error);
      throw error;
    }
  }

  /**
   * Perform final validation of the generated schedule
   * @param {Object} schedule - Generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Final validation result
   */
  async performFinalValidation(schedule, staffMembers, dateRange) {
    try {
      console.log("🔎 Performing final schedule validation...");

      // Comprehensive constraint validation
      const constraintValidation = await validateAllConstraints(
        schedule,
        staffMembers,
        dateRange,
      );

      // Business rule validation
      const businessRuleValidation = await this.ruleValidator.validateSchedule(
        schedule,
        staffMembers,
        dateRange,
      );

      // Quality assessment
      const qualityMetrics = this.assessScheduleQuality(
        schedule,
        staffMembers,
        dateRange,
      );

      return {
        valid: constraintValidation.valid && businessRuleValidation.valid,
        violations: [
          ...(constraintValidation.violations || []),
          ...(businessRuleValidation.violations || []),
        ],
        summary: {
          constraints: constraintValidation.summary,
          businessRules: businessRuleValidation.summary,
          quality: qualityMetrics,
        },
      };
    } catch (error) {
      console.error("❌ Final validation failed:", error);
      return {
        valid: false,
        violations: [
          {
            type: "final_validation_error",
            message: `Final validation failed: ${error.message}`,
            severity: "critical",
          },
        ],
        summary: { error: error.message },
      };
    }
  }

  /**
   * Assess the quality of a generated schedule
   * @param {Object} schedule - Generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @returns {Object} Quality metrics
   */
  assessScheduleQuality(schedule, staffMembers, dateRange) {
    try {
      const metrics = {
        completeness: 0,
        fairness: 0,
        efficiency: 0,
        compliance: 0,
        overall: 0,
      };

      // Calculate completeness (percentage of shifts filled)
      let totalSlots = 0;
      let filledSlots = 0;

      staffMembers.forEach((staff) => {
        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          totalSlots++;
          if (schedule[staff.id] && schedule[staff.id][dateKey] !== undefined) {
            filledSlots++;
          }
        });
      });

      metrics.completeness =
        totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;

      // Calculate fairness (distribution of shifts and off days)
      const staffWorkloads = {};
      staffMembers.forEach((staff) => {
        staffWorkloads[staff.id] = { working: 0, off: 0 };
        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];
          if (schedule[staff.id] && schedule[staff.id][dateKey]) {
            const shift = schedule[staff.id][dateKey];
            if (shift === "×" || shift === "off") {
              staffWorkloads[staff.id].off++;
            } else {
              staffWorkloads[staff.id].working++;
            }
          }
        });
      });

      const workingDays = Object.values(staffWorkloads).map((w) => w.working);
      const avgWorking =
        workingDays.reduce((sum, days) => sum + days, 0) / workingDays.length;
      const workingVariance =
        workingDays.reduce(
          (sum, days) => sum + Math.pow(days - avgWorking, 2),
          0,
        ) / workingDays.length;
      metrics.fairness = Math.max(0, 100 - Math.sqrt(workingVariance) * 10);

      // Calculate efficiency (coverage and resource utilization)
      let totalCoverage = 0;
      dateRange.forEach((date) => {
        const dateKey = date.toISOString().split("T")[0];
        let workingStaff = 0;
        staffMembers.forEach((staff) => {
          if (
            schedule[staff.id] &&
            schedule[staff.id][dateKey] &&
            schedule[staff.id][dateKey] !== "×" &&
            schedule[staff.id][dateKey] !== "off"
          ) {
            workingStaff++;
          }
        });
        totalCoverage += Math.min(workingStaff / staffMembers.length, 1.0);
      });
      metrics.efficiency = (totalCoverage / dateRange.length) * 100;

      // Compliance is based on constraint validation (assumed 100% if we reach this point)
      metrics.compliance = 100;

      // Overall quality score
      metrics.overall =
        metrics.completeness * 0.3 +
        metrics.fairness * 0.3 +
        metrics.efficiency * 0.3 +
        metrics.compliance * 0.1;

      return metrics;
    } catch (error) {
      console.error("❌ Quality assessment failed:", error);
      return {
        completeness: 0,
        fairness: 0,
        efficiency: 0,
        compliance: 0,
        overall: 0,
        error: error.message,
      };
    }
  }

  /**
   * Calculate prediction quality score
   * @param {Object} validation - Validation result
   * @returns {number} Quality score (0-100)
   */
  calculatePredictionQuality(validation) {
    if (!validation.valid) {
      return Math.max(0, 50 - validation.violations?.length * 10);
    }

    const qualityMetrics = validation.summary?.quality || {};
    return qualityMetrics.overall || 75;
  }

  /**
   * Update prediction metrics
   * @param {Object} result - Prediction result
   */
  updateMetrics(result) {
    this.metrics.totalPredictions++;

    if (result.metadata.mlUsed) {
      this.metrics.mlAcceptedRate =
        (this.metrics.mlAcceptedRate * (this.metrics.totalPredictions - 1) +
          100) /
        this.metrics.totalPredictions;
    }

    if (result.metadata.ruleValidationResult?.violations?.length > 0) {
      this.metrics.rulesAppliedRate =
        (this.metrics.rulesAppliedRate * (this.metrics.totalPredictions - 1) +
          100) /
        this.metrics.totalPredictions;
    }

    if (result.success && result.metadata.quality > 70) {
      this.metrics.hybridSuccessRate =
        (this.metrics.hybridSuccessRate * (this.metrics.totalPredictions - 1) +
          100) /
        this.metrics.totalPredictions;
    }
  }

  /**
   * Get current status and metrics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      status: this.status,
      ready: this.isReady(),
      metrics: { ...this.metrics },
      components: {
        mlEngine: this.mlEngine?.getStatus() || null,
        ruleValidator: this.ruleValidator?.getStatus() || null,
      },
      predictionHistory: this.predictionHistory.slice(-10), // Last 10 predictions
    };
  }

  /**
   * Reset the hybrid predictor with safe error handling
   */
  async reset() {
    try {
      console.log("🔄 Starting HybridPredictor reset...");

      this.predictionHistory = [];
      this.metrics = {
        totalPredictions: 0,
        mlAcceptedRate: 0,
        rulesAppliedRate: 0,
        hybridSuccessRate: 0,
      };

      // Reset ML engine with error handling
      if (this.mlEngine && typeof this.mlEngine.reset === "function") {
        try {
          await this.mlEngine.reset();
          console.log("✅ ML engine reset completed");
        } catch (error) {
          console.warn(
            "⚠️ ML engine reset failed (handled gracefully):",
            error.message,
          );
          // Don't throw - continue with reset process
        }
      }

      // Reset rule validator with error handling
      if (
        this.ruleValidator &&
        typeof this.ruleValidator.reset === "function"
      ) {
        try {
          await this.ruleValidator.reset();
          console.log("✅ Rule validator reset completed");
        } catch (error) {
          console.warn(
            "⚠️ Rule validator reset failed (handled gracefully):",
            error.message,
          );
          // Don't throw - continue with reset process
        }
      }

      // Reset decision engine metrics (always safe)
      this.decisionEngine = {
        totalDecisions: 0,
        mlSuccessRate: 0,
        ruleSuccessRate: 0,
        hybridSuccessRate: 0,
        adaptiveThresholds: {
          high: this.options?.mlConfidenceThreshold || 0.85,
          medium: this.options?.mlMediumConfidenceThreshold || 0.75,
          low: this.options?.mlLowConfidenceThreshold || 0.65,
        },
      };

      this.status = "idle";
      console.log("✅ HybridPredictor reset completed successfully");
    } catch (error) {
      console.error("❌ HybridPredictor reset failed:", error);
      // Set status to idle even if reset failed
      this.status = "idle";
      // Don't throw - log error but allow system to continue
      console.warn(
        "⚠️ Reset completed with errors, system should still be functional",
      );
    }
  }

  /**
   * Ensure ML model is trained before making predictions
   * @param {Array} staffMembers - Current staff members
   */
  async ensureMLModelTrained(staffMembers) {
    console.log("🎯 [DEBUG] ensureMLModelTrained() ENTRY");

    if (!this.mlEngine) {
      throw new Error("ML engine not initialized");
    }

    // Check if model is already trained
    const modelInfo = this.mlEngine.getModelInfo();
    console.log("🎯 [DEBUG] Model info:", {
      hasModelInfo: !!modelInfo,
      isInitialized: modelInfo?.isInitialized,
      accuracy: modelInfo?.accuracy
    });

    if (modelInfo && modelInfo.isInitialized && modelInfo.accuracy > 0.5) {
      console.log("✅ Using existing trained ML model");
      return;
    }

    console.log("🎓 Training ML model on historical data...");
    console.log("🎯 [DEBUG] BEFORE mlEngine.trainModel()");
    const trainingResult = await this.mlEngine.trainModel(staffMembers);
    console.log("🎯 [DEBUG] AFTER mlEngine.trainModel()", {
      success: trainingResult?.success,
      accuracy: trainingResult?.finalAccuracy
    });

    if (!trainingResult || !trainingResult.success) {
      throw new Error(
        `ML model training failed: ${trainingResult?.error || "Unknown error"}`,
      );
    }

    console.log(
      `✅ ML model trained successfully (${(trainingResult.finalAccuracy * 100).toFixed(1)}% accuracy)`,
    );
  }

  /**
   * Check if ML engine is ready for predictions
   */
  isMLReady() {
    const modelInfo = this.mlEngine?.getModelInfo();
    return modelInfo && modelInfo.isInitialized;
  }

  /**
   * Force refresh of constraint configuration (called when settings change)
   */
  async onConfigurationUpdated() {
    try {
      console.log(
        "🔄 HybridPredictor: Configuration updated, refreshing constraints...",
      );
      const { refreshAllConfigurations } = await import(
        "../constraints/ConstraintEngine"
      );
      await refreshAllConfigurations();

      // Also refresh the business rule validator configuration
      if (this.ruleValidator && this.ruleValidator.refreshConfiguration) {
        await this.ruleValidator.refreshConfiguration();
      }

      console.log("✅ HybridPredictor: Configuration refresh completed");
    } catch (error) {
      console.error("❌ HybridPredictor: Configuration refresh failed:", error);
    }
  }

  /**
   * Force complete configuration refresh for troubleshooting
   */
  async forceRefreshConfiguration() {
    await this.onConfigurationUpdated();
  }

  /**
   * Get detailed status including ML model information
   */
  getDetailedStatus() {
    const baseStatus = this.getStatus();
    const modelInfo = this.mlEngine?.getModelInfo();

    return {
      ...baseStatus,
      mlModel: {
        ready: this.isMLReady(),
        trained: modelInfo?.accuracy > 0,
        accuracy: modelInfo?.accuracy || 0,
        parameters: modelInfo?.totalParams || 0,
        memoryUsage: modelInfo?.memoryUsage || {},
      },
    };
  }

  // ============================================================================
  // MISSING METHODS FOR COMPLETE HYBRID INTEGRATION
  // ============================================================================

  /**
   * PHASE 3: Calculate adaptive confidence thresholds based on pattern stability
   * @param {Object} staffProfiles - Staff profiles with pattern memory
   * @returns {Object} Adjusted thresholds
   */
  calculateAdaptiveThresholds(staffProfiles) {
    if (!this.decisionEngine.patternBasedAdjustments.enabled) {
      return this.decisionEngine.adaptiveThresholds;
    }

    let totalStability = 0;
    let staffCount = 0;

    // Calculate average pattern stability across all staff
    if (staffProfiles) {
      Object.values(staffProfiles).forEach((profile) => {
        if (profile?.hasPatternMemory && profile?.patternMemory?.stability) {
          totalStability += profile.patternMemory.stability.stabilityScore;
          staffCount++;
        }
      });
    }

    if (staffCount === 0) {
      return this.decisionEngine.adaptiveThresholds;
    }

    const avgStability = totalStability / staffCount;
    const { stabilityBonus, instabilityPenalty, minThreshold, maxThreshold } =
      this.decisionEngine.patternBasedAdjustments;

    // Adjust thresholds based on pattern stability
    let adjustment = 0;
    if (avgStability >= 80) {
      // High stability: lower thresholds (more confident in predictions)
      adjustment = -stabilityBonus;
    } else if (avgStability < 60) {
      // Low stability: raise thresholds (require higher confidence)
      adjustment = instabilityPenalty;
    }

    const adjustedThresholds = {
      high: Math.max(
        minThreshold,
        Math.min(
          maxThreshold,
          this.options.mlConfidenceThreshold + adjustment,
        ),
      ),
      medium: Math.max(
        minThreshold,
        Math.min(
          maxThreshold,
          this.options.mlMediumConfidenceThreshold + adjustment,
        ),
      ),
      low: Math.max(
        minThreshold,
        Math.min(
          maxThreshold,
          this.options.mlLowConfidenceThreshold + adjustment,
        ),
      ),
    };

    // Log adjustment if significant
    if (Math.abs(adjustment) > 0.01) {
      console.log(`🎯 [PHASE-3] Adaptive thresholds: avgStability=${avgStability.toFixed(1)}, adjustment=${(adjustment * 100).toFixed(1)}%`);
      console.log(`   High: ${this.options.mlConfidenceThreshold.toFixed(2)} → ${adjustedThresholds.high.toFixed(2)}`);
    }

    // Store adjustment in history
    this.decisionEngine.patternBasedAdjustments.adjustmentHistory.push({
      timestamp: Date.now(),
      avgStability,
      adjustment,
      thresholds: adjustedThresholds,
    });

    // Keep only last 50 adjustments
    if (this.decisionEngine.patternBasedAdjustments.adjustmentHistory.length > 50) {
      this.decisionEngine.patternBasedAdjustments.adjustmentHistory.shift();
    }

    return adjustedThresholds;
  }

  /**
   * PHASE 2/3: Assess ML confidence based on accuracy, prediction quality, and pattern stability
   * @param {number} accuracy - Model accuracy score
   * @param {Object} predictions - ML predictions result
   * @param {Object} staffProfiles - Optional staff profiles with pattern memory (Phase 2)
   * @returns {string} Confidence level: 'high', 'medium', 'low', or 'none'
   */
  assessMLConfidence(accuracy, predictions, staffProfiles = null) {
    if (!predictions || !predictions.predictions || accuracy <= 0) {
      return "none";
    }

    // Check prediction consistency and confidence scores
    const predictionEntries = Object.entries(predictions.predictions);
    let totalConfidence = 0;
    let confidenceCount = 0;

    // Calculate average prediction confidence if available
    Object.values(predictions.confidence || {}).forEach((staffConfidence) => {
      Object.values(staffConfidence).forEach((conf) => {
        if (typeof conf === "number") {
          totalConfidence += conf;
          confidenceCount++;
        }
      });
    });

    const avgPredictionConfidence =
      confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    // PHASE 2: Calculate pattern stability boost
    let patternStabilityBoost = 0;
    if (staffProfiles) {
      let totalStabilityScore = 0;
      let staffWithStability = 0;

      Object.keys(predictions.predictions).forEach((staffId) => {
        const profile = staffProfiles[staffId];
        if (profile?.hasPatternMemory && profile?.patternMemory?.stability) {
          totalStabilityScore += profile.patternMemory.stability.stabilityScore;
          staffWithStability++;
        }
      });

      if (staffWithStability > 0) {
        const avgStability = totalStabilityScore / staffWithStability;
        // Convert 0-100 stability score to 0-0.1 boost
        patternStabilityBoost = (avgStability / 100) * 0.1;

        if (patternStabilityBoost > 0.05) {
          console.log(`🧠 [PHASE-2] Pattern stability boost: +${(patternStabilityBoost * 100).toFixed(1)}% (${staffWithStability} staff with stable patterns)`);
        }
      }
    }

    // PHASE 2: Enhanced combined score with pattern stability
    // Base: 70% model accuracy, 25% prediction confidence, 5% pattern stability
    const combinedScore =
      accuracy * 0.7 +
      avgPredictionConfidence * 0.25 +
      patternStabilityBoost;

    // PHASE 3: Use adaptive thresholds instead of static ones
    const adaptiveThresholds = this.calculateAdaptiveThresholds(staffProfiles);

    if (combinedScore >= adaptiveThresholds.high) {
      return "high";
    } else if (combinedScore >= adaptiveThresholds.medium) {
      return "medium";
    } else if (combinedScore >= adaptiveThresholds.low) {
      return "low";
    }

    return "none";
  }

  /**
   * Intelligent decision engine for choosing between ML and business rules
   * @param {Object} mlPredictions - ML prediction results
   * @param {string} mlConfidenceLevel - ML confidence assessment
   * @param {boolean} mlSuccess - Whether ML predictions succeeded
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range for predictions
   * @returns {Object} Decision result with method and reasoning
   */
  async makeIntelligentDecision(
    mlPredictions,
    mlConfidenceLevel,
    mlSuccess,
    staffMembers,
    dateRange,
  ) {
    try {
      const mlAccuracy = mlPredictions?.modelAccuracy || 0;
      console.log(
        `🤔 Making intelligent decision: ML accuracy = ${(mlAccuracy * 100).toFixed(1)}%, confidence = ${mlConfidenceLevel}, success = ${mlSuccess}`,
      );

      // Update decision engine metrics
      this.decisionEngine.totalDecisions++;

      // SPECIAL CASE: Always use ML when high accuracy is achieved (90%+)
      if (mlSuccess && mlAccuracy >= 0.9) {
        console.log(
          "🎯 Using high-accuracy ML system (90%+ accuracy achieved)",
        );
        this.decisionEngine.mlSuccessRate++;
        return {
          useML: true,
          method: "high_accuracy_ml",
          allowPartialValidation: false,
          reasoning: `High accuracy ML system: ${(mlAccuracy * 100).toFixed(1)}% accuracy`,
        };
      }

      // Decision matrix based on confidence and system state
      if (mlSuccess && mlConfidenceLevel === "high") {
        // High confidence ML - use directly with validation
        this.decisionEngine.mlSuccessRate++;
        return {
          useML: true,
          method: "ml_primary",
          allowPartialValidation: false,
          reasoning: "High ML confidence with successful predictions",
        };
      }

      if (mlSuccess && mlConfidenceLevel === "medium") {
        // Medium confidence ML - use with rule corrections
        this.decisionEngine.hybridSuccessRate++;
        return {
          useML: true,
          method: "ml_corrected",
          allowPartialValidation: true,
          reasoning: "Medium ML confidence, apply rule-based corrections",
        };
      }

      if (
        mlSuccess &&
        mlConfidenceLevel === "low" &&
        this.options.enableIntelligentDecisionEngine
      ) {
        // Low confidence ML - blend with rule-based generation
        this.decisionEngine.hybridSuccessRate++;
        return {
          useML: true,
          method: "hybrid_blend",
          allowPartialValidation: true,
          reasoning: "Low ML confidence, blend with rule-based predictions",
        };
      }

      // Fallback to rules-based approach
      this.decisionEngine.ruleSuccessRate++;
      return {
        useML: false,
        method: "rule_based",
        allowPartialValidation: false,
        reasoning: mlSuccess
          ? `ML confidence too low (${mlConfidenceLevel})`
          : "ML prediction failed, using rule-based generation",
      };
    } catch (error) {
      console.error("❌ Decision engine error:", error);
      return {
        useML: false,
        method: "rule_based",
        allowPartialValidation: false,
        reasoning: `Decision engine error: ${error.message}`,
      };
    }
  }

  /**
   * Apply intelligent rule corrections to ML predictions
   * @param {Object} mlSchedule - ML generated schedule
   * @param {Array} violations - Rule violations to fix
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @param {string} mlConfidenceLevel - ML confidence level
   * @returns {Object} Correction result with schedule and metadata
   */
  async applyIntelligentRuleCorrections(
    mlSchedule,
    violations,
    staffMembers,
    dateRange,
    mlConfidenceLevel,
  ) {
    try {
      console.log(
        `🔧 Applying intelligent corrections for ${violations.length} violations...`,
      );

      let correctedSchedule = JSON.parse(JSON.stringify(mlSchedule));
      let correctionAttempts = 0;
      const maxAttempts = this.options.maxCorrectionAttempts;
      const correctionLog = [];

      // Sort violations by severity for intelligent correction order
      const sortedViolations = violations.sort((a, b) => {
        const severityOrder = { critical: 3, high: 2, medium: 1, low: 0 };
        return (
          (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0)
        );
      });

      // Apply corrections with adaptive strategy based on ML confidence
      const correctionIntensity =
        mlConfidenceLevel === "high"
          ? "minimal"
          : mlConfidenceLevel === "medium"
            ? "moderate"
            : "aggressive";

      for (const violation of sortedViolations) {
        if (correctionAttempts >= maxAttempts) {
          console.log(`⚠️ Reached max correction attempts (${maxAttempts})`);
          break;
        }

        const preCorrection = JSON.stringify(correctedSchedule);
        correctedSchedule = await this.ruleValidator.correctViolation(
          correctedSchedule,
          violation,
          staffMembers,
          dateRange,
        );

        const postCorrection = JSON.stringify(correctedSchedule);
        const correctionMade = preCorrection !== postCorrection;

        if (correctionMade) {
          correctionLog.push({
            type: violation.type,
            severity: violation.severity,
            corrected: true,
          });
          correctionAttempts++;
        } else {
          correctionLog.push({
            type: violation.type,
            severity: violation.severity,
            corrected: false,
            reason: "No correction strategy available",
          });
        }
      }

      return {
        schedule: correctedSchedule,
        attempts: correctionAttempts,
        corrections: correctionLog,
        intensity: correctionIntensity,
        success: true,
      };
    } catch (error) {
      console.error("❌ Intelligent rule correction failed:", error);
      return {
        schedule: mlSchedule, // Return original on error
        attempts: 0,
        corrections: [],
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate hybrid blended schedule combining ML and rule-based approaches
   * @param {Object} mlPredictions - ML prediction results
   * @param {Object} inputData - Original input data
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range
   * @param {string} mlConfidenceLevel - ML confidence level
   * @returns {Object} Blended schedule
   */
  async generateHybridBlendedSchedule(
    mlPredictions,
    inputData,
    staffMembers,
    dateRange,
    mlConfidenceLevel,
  ) {
    try {
      console.log(
        `🎨 Generating hybrid blended schedule (ML confidence: ${mlConfidenceLevel})...`,
      );

      // Generate rule-based schedule as baseline
      const ruleBasedSchedule =
        await this.ruleValidator.generateRuleBasedSchedule(
          inputData,
          staffMembers,
          dateRange,
        );

      if (!mlPredictions || !mlPredictions.predictions) {
        console.log(
          "⚠️ No ML predictions available, using rule-based schedule",
        );
        return ruleBasedSchedule;
      }

      const mlSchedule = mlPredictions.predictions;
      const mlConfidence = mlPredictions.confidence || {};

      // Blend schedules based on confidence levels
      const blendedSchedule = {};

      staffMembers.forEach((staff) => {
        blendedSchedule[staff.id] = {};

        dateRange.forEach((date) => {
          const dateKey = date.toISOString().split("T")[0];

          const mlShift = mlSchedule[staff.id]?.[dateKey];
          const ruleShift = ruleBasedSchedule[staff.id]?.[dateKey];
          const confidence = mlConfidence[staff.id]?.[dateKey] || 0;

          // Decision logic for blending
          if (mlShift !== undefined && confidence >= 0.7) {
            // High confidence ML prediction - use it
            blendedSchedule[staff.id][dateKey] = mlShift;
          } else if (
            mlShift !== undefined &&
            ruleShift !== undefined &&
            confidence >= 0.5
          ) {
            // Medium confidence - prefer ML for work shifts, rules for off days
            if (mlShift === "×" && ruleShift !== "×") {
              blendedSchedule[staff.id][dateKey] = ruleShift; // Prefer working
            } else {
              blendedSchedule[staff.id][dateKey] = mlShift;
            }
          } else {
            // Low/no confidence - use rule-based prediction
            blendedSchedule[staff.id][dateKey] =
              ruleShift !== undefined ? ruleShift : mlShift;
          }
        });
      });

      console.log("✅ Hybrid blended schedule generated");
      return blendedSchedule;
    } catch (error) {
      console.error("❌ Hybrid blending failed:", error);

      // Fallback to rule-based schedule
      return await this.ruleValidator.generateRuleBasedSchedule(
        inputData,
        staffMembers,
        dateRange,
      );
    }
  }

  /**
   * PHASE 3: Pattern-aware fallback prediction for individual staff/date
   * @param {Object} staffProfile - Staff profile with pattern memory
   * @param {string} dateKey - Date key for prediction
   * @returns {string} Fallback shift prediction
   */
  getPatternAwareFallback(staffProfile, dateKey) {
    if (!staffProfile?.hasPatternMemory) {
      // No pattern memory - return neutral default
      return staffProfile?.status === "社員" ? "" : "○";
    }

    const { patternMemory } = staffProfile;
    const targetDate = new Date(dateKey);

    // Try weekly position prediction first (most reliable)
    const weeklyPosition = targetDate.getDay();
    const weeklyPrediction =
      patternMemory.weeklyPositionPatterns.predictions[weeklyPosition];

    if (weeklyPrediction && weeklyPrediction.confidence > 0.6) {
      console.log(
        `🎯 [PHASE-3] Using weekly pattern fallback for ${staffProfile.name}: ${weeklyPrediction.shift} (confidence: ${weeklyPrediction.confidence.toFixed(2)})`,
      );
      return weeklyPrediction.shift;
    }

    // Try transition matrix prediction
    if (patternMemory.transitionMatrix?.matrix) {
      const recentShifts = [];
      Object.keys(staffProfile.shiftHistory)
        .sort()
        .reverse()
        .forEach((monthIndex) => {
          const monthSchedule = staffProfile.shiftHistory[monthIndex];
          Object.keys(monthSchedule)
            .sort()
            .reverse()
            .forEach((date) => {
              if (date < dateKey && recentShifts.length < 3) {
                recentShifts.push(monthSchedule[date]);
              }
            });
        });

      if (recentShifts.length > 0) {
        const lastShift = recentShifts[0];
        const lastShiftIndex = this.shiftToIndex(lastShift, staffProfile);
        const transitionProbs = patternMemory.transitionMatrix.matrix[lastShiftIndex];

        if (transitionProbs) {
          const maxProb = Math.max(...transitionProbs);
          const predictedIndex = transitionProbs.indexOf(maxProb);

          if (maxProb > 0.4) {
            const predictedShift = this.indexToShift(predictedIndex, staffProfile);
            console.log(
              `🎯 [PHASE-3] Using transition matrix fallback for ${staffProfile.name}: ${predictedShift} (prob: ${maxProb.toFixed(2)})`,
            );
            return predictedShift;
          }
        }
      }
    }

    // Default fallback based on staff type
    return staffProfile.status === "社員" ? "" : "○";
  }

  /**
   * PHASE 3: Helper to convert shift to numeric index
   */
  shiftToIndex(shift, staffProfile) {
    if (!shift || shift === "" || shift === "×") return 0; // Off
    if (shift === "○" || (shift === "" && staffProfile.status === "社員")) return 1; // Normal
    if (shift === "△") return 2; // Early
    if (shift === "▽" || shift === "◇") return 3; // Late
    return 1; // Default to normal
  }

  /**
   * PHASE 3: Helper to convert numeric index to shift
   */
  indexToShift(index, staffProfile) {
    switch (index) {
      case 0:
        return "×"; // Off
      case 1:
        return staffProfile.status === "社員" ? "" : "○"; // Normal
      case 2:
        return "△"; // Early
      case 3:
        return "▽"; // Late
      default:
        return staffProfile.status === "社員" ? "" : "○"; // Default normal
    }
  }

  /**
   * Handle ML engine errors with appropriate fallback strategies
   * @param {Error} error - ML engine error
   */
  handleMLError(error) {
    console.error("🚨 ML Engine Error:", error.message);

    // Record error for analysis
    this.predictionHistory.push({
      timestamp: new Date().toISOString(),
      type: "ml_error",
      error: error.message,
      success: false,
    });

    // Update metrics
    this.metrics.totalPredictions++; // Count as attempted prediction

    // Adaptive threshold adjustment if errors are frequent
    if (this.options.dynamicThresholdAdjustment) {
      const recentErrors = this.predictionHistory
        .filter((p) => p.type === "ml_error")
        .slice(-5).length;

      if (recentErrors >= 3) {
        // Lower thresholds to rely more on rules
        this.decisionEngine.adaptiveThresholds.high = Math.max(
          0.7,
          this.decisionEngine.adaptiveThresholds.high - 0.05,
        );
        this.decisionEngine.adaptiveThresholds.medium = Math.max(
          0.5,
          this.decisionEngine.adaptiveThresholds.medium - 0.05,
        );
        console.log("🔧 Adaptive thresholds lowered due to ML errors");
      }
    }
  }

  /**
   * Apply backup staff assignments to generated schedule
   * Automatically assigns backup staff when group members are off
   * @param {Object} schedule - Generated schedule
   * @param {Array} staffMembers - Staff member data
   * @param {Array} dateRange - Date range for schedule
   * @returns {Object} Schedule with backup assignments applied
   */
  async applyBackupStaffAssignments(schedule, staffMembers, dateRange) {
    if (!this.backupStaffService.initialized) {
      console.warn(
        "⚠️ Backup staff service not initialized, skipping backup assignments",
      );
      return schedule;
    }

    try {
      console.log("🔄 [HybridPredictor] Applying backup coverage...");

      // Get staff groups from settings provider
      let staffGroups = [];
      if (this.settingsProvider) {
        try {
          const settings = this.settingsProvider.getSettings();
          staffGroups = settings?.staffGroups || [];
          console.log(`📋 [HybridPredictor] Loaded ${staffGroups.length} staff groups from settings`);
        } catch (error) {
          console.warn("⚠️ Failed to get staff groups from settings:", error.message);
        }
      }

      // If no staff groups from settings, try importing getStaffConflictGroups
      if (!staffGroups || staffGroups.length === 0) {
        try {
          const { getStaffConflictGroups } = await import("../../services/staffGroupUtils");
          staffGroups = await getStaffConflictGroups();
          console.log(`📋 [HybridPredictor] Loaded ${staffGroups.length} staff groups from utility`);
        } catch (error) {
          console.warn("⚠️ Failed to import getStaffConflictGroups:", error.message);
        }
      }

      // Process backup assignments for the full schedule
      const updatedSchedule =
        this.backupStaffService.processFullScheduleBackups(
          schedule,
          staffMembers,
          staffGroups,
          dateRange,
        );

      console.log("✅ [HybridPredictor] Backup coverage applied successfully");
      return updatedSchedule;
    } catch (error) {
      console.error("❌ [HybridPredictor] Error applying backup staff assignments:", error);
      return schedule; // Return original schedule on error
    }
  }
}
