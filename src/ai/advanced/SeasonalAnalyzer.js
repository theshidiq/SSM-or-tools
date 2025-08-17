/**
 * SeasonalAnalyzer.js
 *
 * Phase 3: Seasonal Pattern Analysis for intelligent scheduling adaptation
 * Analyzes seasonal trends, holiday patterns, demand forecasting, and dynamic constraint adjustment
 */

/**
 * Seasonal Analyzer for adaptive scheduling based on temporal patterns
 */
export class SeasonalAnalyzer {
  constructor() {
    this.initialized = false;
    this.version = "1.0.0";

    // Seasonal data storage
    this.seasonalPatterns = new Map();
    this.holidayPatterns = new Map();
    this.demandForecasts = new Map();
    this.historicalSeasons = [];

    // Pattern recognition results
    this.recognizedPatterns = {
      seasonal: {},
      weekly: {},
      monthly: {},
      holiday: {},
      special: {},
    };

    // Configuration
    this.config = {
      seasonalWindow: 365, // Days to analyze for seasonal patterns
      forecastHorizon: 90, // Days to forecast ahead
      adaptationThreshold: 0.15, // Threshold for pattern adaptation
      holidayInfluence: 0.25, // Holiday impact factor
      demandSmoothingFactor: 0.3, // Exponential smoothing factor
      patternConfidenceThreshold: 0.7,
      seasonDefinitions: {
        spring: {
          months: [2, 3, 4],
          characteristics: ["moderate_demand", "stable_patterns"],
        },
        summer: {
          months: [5, 6, 7],
          characteristics: ["high_demand", "vacation_season"],
        },
        fall: {
          months: [8, 9, 10],
          characteristics: ["increasing_demand", "back_to_school"],
        },
        winter: {
          months: [11, 0, 1],
          characteristics: ["variable_demand", "holiday_season"],
        },
      },
    };

    // Japanese holidays and special dates
    this.holidays = new Map([
      [
        "01-01",
        {
          name: "元日",
          type: "national",
          impact: "high",
          staffingAdjustment: -0.3,
        },
      ],
      [
        "01-08",
        {
          name: "成人の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "02-11",
        {
          name: "建国記念の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "02-23",
        {
          name: "天皇誕生日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "03-20",
        {
          name: "春分の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "04-29",
        {
          name: "昭和の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "05-03",
        {
          name: "憲法記念日",
          type: "national",
          impact: "high",
          staffingAdjustment: -0.2,
        },
      ],
      [
        "05-04",
        {
          name: "みどりの日",
          type: "national",
          impact: "high",
          staffingAdjustment: -0.2,
        },
      ],
      [
        "05-05",
        {
          name: "こどもの日",
          type: "national",
          impact: "high",
          staffingAdjustment: -0.2,
        },
      ],
      [
        "07-20",
        {
          name: "海の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "08-11",
        {
          name: "山の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "09-15",
        {
          name: "敬老の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "09-22",
        {
          name: "秋分の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "10-10",
        {
          name: "スポーツの日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "11-03",
        {
          name: "文化の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "11-23",
        {
          name: "勤労感謝の日",
          type: "national",
          impact: "medium",
          staffingAdjustment: -0.1,
        },
      ],
      [
        "12-29",
        {
          name: "年末休暇",
          type: "business",
          impact: "high",
          staffingAdjustment: -0.4,
        },
      ],
      [
        "12-30",
        {
          name: "年末休暇",
          type: "business",
          impact: "high",
          staffingAdjustment: -0.4,
        },
      ],
      [
        "12-31",
        {
          name: "大晦日",
          type: "business",
          impact: "high",
          staffingAdjustment: -0.4,
        },
      ],
    ]);

    // Performance metrics
    this.metrics = {
      patternAccuracy: 0,
      forecastAccuracy: 0,
      adaptationSuccess: 0,
      holidayPredictionAccuracy: 0,
      demandForecastMAPE: 0, // Mean Absolute Percentage Error
      totalAnalyses: 0,
      successfulAdaptations: 0,
    };
  }

  /**
   * Initialize the seasonal analyzer
   * @param {Object} config - Configuration options
   * @returns {Object} Initialization result
   */
  async initialize(config = {}) {
    console.log("🗓️ Initializing Seasonal Analyzer...");

    try {
      // Merge configuration
      this.config = { ...this.config, ...config };

      // Initialize seasonal pattern storage
      this.initializeSeasonalStorage();

      // Load pre-defined seasonal patterns
      this.loadBaseSeasonalPatterns();

      this.initialized = true;

      console.log("✅ Seasonal Analyzer initialized");
      console.log(`Forecast horizon: ${this.config.forecastHorizon} days`);
      console.log(
        `Pattern confidence threshold: ${this.config.patternConfidenceThreshold}`,
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        forecastHorizon: this.config.forecastHorizon,
        holidaysLoaded: this.holidays.size,
        seasonsConfigured: Object.keys(this.config.seasonDefinitions).length,
      };
    } catch (error) {
      console.error("❌ Seasonal Analyzer initialization failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Initialize seasonal pattern storage
   */
  initializeSeasonalStorage() {
    const seasons = Object.keys(this.config.seasonDefinitions);

    seasons.forEach((season) => {
      this.seasonalPatterns.set(season, {
        demandPatterns: {},
        staffingPatterns: {},
        shiftDistributions: {},
        workloadFactors: {},
        confidence: 0,
      });
    });
  }

  /**
   * Load base seasonal patterns
   */
  loadBaseSeasonalPatterns() {
    // Load default patterns for each season
    this.seasonalPatterns.set("spring", {
      demandPatterns: { overall: 0.8, weekends: 1.1, weekdays: 0.7 },
      staffingPatterns: { preferred: 0.85, minimum: 0.75 },
      shiftDistributions: { early: 0.2, normal: 0.6, late: 0.2 },
      workloadFactors: { base: 1.0, peak: 1.2 },
      confidence: 0.5,
    });

    this.seasonalPatterns.set("summer", {
      demandPatterns: { overall: 1.2, weekends: 1.4, weekdays: 1.0 },
      staffingPatterns: { preferred: 0.9, minimum: 0.8 },
      shiftDistributions: { early: 0.25, normal: 0.5, late: 0.25 },
      workloadFactors: { base: 1.1, peak: 1.5 },
      confidence: 0.5,
    });

    this.seasonalPatterns.set("fall", {
      demandPatterns: { overall: 0.9, weekends: 1.2, weekdays: 0.8 },
      staffingPatterns: { preferred: 0.85, minimum: 0.75 },
      shiftDistributions: { early: 0.2, normal: 0.65, late: 0.15 },
      workloadFactors: { base: 1.0, peak: 1.3 },
      confidence: 0.5,
    });

    this.seasonalPatterns.set("winter", {
      demandPatterns: { overall: 1.0, weekends: 1.3, weekdays: 0.9 },
      staffingPatterns: { preferred: 0.8, minimum: 0.7 },
      shiftDistributions: { early: 0.15, normal: 0.7, late: 0.15 },
      workloadFactors: { base: 0.9, peak: 1.4 },
      confidence: 0.5,
    });
  }

  /**
   * Analyze historical seasonal data
   * @param {Object} historicalData - Historical scheduling data
   * @returns {Object} Seasonal analysis results
   */
  async analyzeHistoricalSeasons(historicalData) {
    if (!this.initialized) {
      throw new Error("Seasonal Analyzer not initialized");
    }

    console.log("📊 Analyzing historical seasonal patterns...");

    try {
      const startTime = Date.now();

      // Extract seasonal patterns from historical data
      const seasonalAnalysis =
        await this.extractSeasonalPatterns(historicalData);

      // Analyze holiday impacts
      const holidayAnalysis = await this.analyzeHolidayPatterns(historicalData);

      // Generate demand forecasting models
      const demandModels =
        await this.buildDemandForecastingModels(historicalData);

      // Identify recurring patterns
      const recurringPatterns =
        await this.identifyRecurringPatterns(historicalData);

      // Update pattern storage
      this.updateSeasonalPatterns(
        seasonalAnalysis,
        holidayAnalysis,
        demandModels,
      );

      // Store historical seasons for future reference
      this.historicalSeasons.push({
        timestamp: new Date().toISOString(),
        analysis: seasonalAnalysis,
        holidayAnalysis,
        demandModels,
        recurringPatterns,
      });

      // Keep only last 5 years of historical data
      if (this.historicalSeasons.length > 5) {
        this.historicalSeasons = this.historicalSeasons.slice(-5);
      }

      const analysisTime = Date.now() - startTime;
      this.metrics.totalAnalyses++;
      this.metrics.patternAccuracy =
        this.calculatePatternAccuracy(seasonalAnalysis);

      console.log(
        `✅ Historical seasonal analysis completed in ${analysisTime}ms`,
      );
      console.log(
        `🎯 Pattern accuracy: ${this.metrics.patternAccuracy.toFixed(2)}%`,
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        analysisTime,
        seasonalPatterns: seasonalAnalysis,
        holidayPatterns: holidayAnalysis,
        demandForecasts: demandModels,
        recurringPatterns,
        confidence: this.calculateOverallConfidence(),
        recommendations: this.generateSeasonalRecommendations(seasonalAnalysis),
      };
    } catch (error) {
      console.error("❌ Historical seasonal analysis failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Analyze current season and provide context
   * @param {Object} params - Analysis parameters
   * @returns {Object} Current seasonal analysis
   */
  async analyzeCurrentSeason(params) {
    const { monthIndex, dateRange, historicalData = {} } = params;

    console.log(`🌸 Analyzing current season for period ${monthIndex}...`);

    try {
      const currentDate = new Date();
      const season = this.getCurrentSeason(currentDate);
      const seasonalContext = this.getSeasonalContext(season, currentDate);

      // Get seasonal patterns for current season
      const seasonalPatterns = this.seasonalPatterns.get(season) || {};

      // Analyze upcoming holidays in date range
      const upcomingHolidays = this.analyzeUpcomingHolidays(dateRange);

      // Generate demand forecast for the period
      const demandForecast = await this.generateDemandForecast(
        dateRange,
        season,
      );

      // Calculate seasonal adjustments
      const seasonalAdjustments = this.calculateSeasonalAdjustments(
        season,
        upcomingHolidays,
      );

      // Check for special events or patterns
      const specialEvents = this.identifySpecialEvents(
        dateRange,
        historicalData,
      );

      const result = {
        success: true,
        timestamp: new Date().toISOString(),
        currentSeason: season,
        seasonalContext,
        patterns: seasonalPatterns,
        upcomingHolidays,
        demandForecast,
        seasonalAdjustments,
        specialEvents,
        recommendations: this.generateCurrentSeasonRecommendations(
          season,
          upcomingHolidays,
          demandForecast,
        ),
        confidence: seasonalPatterns.confidence || 0.5,
      };

      console.log(`✅ Current season analysis completed for ${season}`);
      console.log(`📅 Found ${upcomingHolidays.length} upcoming holidays`);
      console.log(`📈 Demand forecast: ${demandForecast.trend}`);

      return result;
    } catch (error) {
      console.error("❌ Current season analysis failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        currentSeason: "unknown",
        confidence: 0,
      };
    }
  }

  /**
   * Apply seasonal adaptations to a schedule
   * @param {Object} params - Application parameters
   * @returns {Object} Seasonally adapted schedule
   */
  async applySeasonalAdaptations(params) {
    const { schedule, staffMembers, dateRange, seasonalAnalysis } = params;

    console.log("🎯 Applying seasonal adaptations to schedule...");

    try {
      const adaptedSchedule = JSON.parse(JSON.stringify(schedule)); // Deep copy
      const adaptations = [];
      let adaptationScore = 0;

      // Apply holiday-based adaptations
      const holidayAdaptations = await this.applyHolidayAdaptations(
        adaptedSchedule,
        staffMembers,
        dateRange,
        seasonalAnalysis.upcomingHolidays || [],
      );
      adaptations.push(...holidayAdaptations);

      // Apply demand-based adaptations
      const demandAdaptations = await this.applyDemandBasedAdaptations(
        adaptedSchedule,
        staffMembers,
        dateRange,
        seasonalAnalysis.demandForecast || {},
      );
      adaptations.push(...demandAdaptations);

      // Apply seasonal pattern adaptations
      const patternAdaptations = await this.applyPatternAdaptations(
        adaptedSchedule,
        staffMembers,
        dateRange,
        seasonalAnalysis.patterns || {},
      );
      adaptations.push(...patternAdaptations);

      // Calculate adaptation score
      adaptationScore = this.calculateAdaptationScore(adaptations);

      // Update metrics
      this.metrics.successfulAdaptations++;
      this.metrics.adaptationSuccess = adaptationScore;

      console.log(`✅ Applied ${adaptations.length} seasonal adaptations`);
      console.log(`📊 Adaptation score: ${adaptationScore.toFixed(1)}%`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        schedule: adaptedSchedule,
        adaptations,
        adaptationScore,
        seasonalContext: seasonalAnalysis,
        recommendations: this.generateAdaptationRecommendations(adaptations),
      };
    } catch (error) {
      console.error("❌ Seasonal adaptation failed:", error);
      return {
        success: false,
        error: error.message,
        schedule,
        adaptationScore: 0,
        adaptations: [],
      };
    }
  }

  /**
   * Detect seasonal deviations from expected patterns
   * @returns {Object} Deviation analysis
   */
  async detectDeviations() {
    console.log("🔍 Detecting seasonal pattern deviations...");

    try {
      const currentDate = new Date();
      const season = this.getCurrentSeason(currentDate);
      const expectedPatterns = this.seasonalPatterns.get(season) || {};

      // Get current patterns (simplified - would analyze real-time data)
      const currentPatterns = await this.getCurrentPatterns();

      const deviations = [];

      // Check demand deviations
      if (expectedPatterns.demandPatterns && currentPatterns.demand) {
        const demandDeviation = this.calculateDeviation(
          currentPatterns.demand,
          expectedPatterns.demandPatterns.overall,
        );

        if (Math.abs(demandDeviation) > this.config.adaptationThreshold) {
          deviations.push({
            type: "demand",
            severity: Math.abs(demandDeviation),
            direction: demandDeviation > 0 ? "higher" : "lower",
            expectedValue: expectedPatterns.demandPatterns.overall,
            actualValue: currentPatterns.demand,
            recommendedAction:
              demandDeviation > 0 ? "increase_staffing" : "optimize_efficiency",
          });
        }
      }

      // Check staffing pattern deviations
      if (expectedPatterns.staffingPatterns && currentPatterns.staffing) {
        const staffingDeviation = this.calculateDeviation(
          currentPatterns.staffing,
          expectedPatterns.staffingPatterns.preferred,
        );

        if (Math.abs(staffingDeviation) > this.config.adaptationThreshold) {
          deviations.push({
            type: "staffing",
            severity: Math.abs(staffingDeviation),
            direction: staffingDeviation > 0 ? "overstaffed" : "understaffed",
            expectedValue: expectedPatterns.staffingPatterns.preferred,
            actualValue: currentPatterns.staffing,
            recommendedAction:
              staffingDeviation > 0
                ? "optimize_scheduling"
                : "increase_coverage",
          });
        }
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        season,
        deviations,
        overallSeverity:
          deviations.length > 0
            ? Math.max(...deviations.map((d) => d.severity))
            : 0,
        recommendations: this.generateDeviationRecommendations(deviations),
      };
    } catch (error) {
      console.error("❌ Deviation detection failed:", error);
      return {
        success: false,
        error: error.message,
        deviations: [],
        overallSeverity: 0,
      };
    }
  }

  /**
   * Extract seasonal patterns from historical data
   * @param {Object} historicalData - Historical data
   * @returns {Object} Extracted patterns
   */
  async extractSeasonalPatterns(historicalData) {
    const patterns = {};

    if (!historicalData.scheduleData) {
      return patterns;
    }

    // Group data by seasons
    const seasonalData = this.groupDataBySeasons(historicalData);

    // Analyze each season
    Object.entries(seasonalData).forEach(([season, data]) => {
      patterns[season] = {
        averageStaffing: this.calculateAverageStaffing(data),
        shiftDistribution: this.calculateShiftDistribution(data),
        workloadPatterns: this.calculateWorkloadPatterns(data),
        dayOffPatterns: this.calculateDayOffPatterns(data),
        weeklyPatterns: this.calculateWeeklyPatterns(data),
        confidence: this.calculatePatternConfidence(data),
      };
    });

    return patterns;
  }

  /**
   * Analyze holiday patterns in historical data
   * @param {Object} historicalData - Historical data
   * @returns {Object} Holiday analysis
   */
  async analyzeHolidayPatterns(historicalData) {
    const holidayPatterns = {};

    // Analyze each holiday's impact
    this.holidays.forEach((holiday, dateKey) => {
      const impactData = this.analyzeHolidayImpact(
        historicalData,
        dateKey,
        holiday,
      );

      holidayPatterns[dateKey] = {
        ...holiday,
        historicalImpact: impactData,
        staffingAdjustment: this.calculateHolidayStaffingAdjustment(impactData),
        confidence: impactData.dataPoints > 2 ? 0.8 : 0.4,
      };
    });

    return holidayPatterns;
  }

  /**
   * Build demand forecasting models
   * @param {Object} historicalData - Historical data
   * @returns {Object} Demand models
   */
  async buildDemandForecastingModels(historicalData) {
    const models = {};

    // Simple exponential smoothing model for each season
    Object.keys(this.config.seasonDefinitions).forEach((season) => {
      const seasonalData = this.getSeasonalHistoricalData(
        historicalData,
        season,
      );
      const model = this.buildExponentialSmoothingModel(seasonalData);

      models[season] = {
        type: "exponential_smoothing",
        parameters: model.parameters,
        accuracy: model.accuracy,
        forecast: model.forecast,
        confidence: model.confidence,
      };
    });

    return models;
  }

  /**
   * Identify recurring patterns
   * @param {Object} historicalData - Historical data
   * @returns {Object} Recurring patterns
   */
  async identifyRecurringPatterns(historicalData) {
    const patterns = {
      weekly: this.identifyWeeklyPatterns(historicalData),
      monthly: this.identifyMonthlyPatterns(historicalData),
      seasonal: this.identifySeasonalRecurrence(historicalData),
      special: this.identifySpecialPatterns(historicalData),
    };

    return patterns;
  }

  /**
   * Update seasonal patterns with new analysis
   * @param {Object} seasonalAnalysis - Seasonal analysis results
   * @param {Object} holidayAnalysis - Holiday analysis results
   * @param {Object} demandModels - Demand forecasting models
   */
  updateSeasonalPatterns(seasonalAnalysis, holidayAnalysis, demandModels) {
    // Update seasonal patterns
    Object.entries(seasonalAnalysis).forEach(([season, patterns]) => {
      const existingPatterns = this.seasonalPatterns.get(season) || {};

      // Merge with existing patterns using weighted average
      const updatedPatterns = this.mergePatterns(existingPatterns, patterns);
      this.seasonalPatterns.set(season, updatedPatterns);
    });

    // Update holiday patterns
    Object.entries(holidayAnalysis).forEach(([dateKey, analysis]) => {
      this.holidayPatterns.set(dateKey, analysis);
    });

    // Update demand forecasts
    Object.entries(demandModels).forEach(([season, model]) => {
      this.demandForecasts.set(season, model);
    });
  }

  /**
   * Get current season based on date
   * @param {Date} date - Current date
   * @returns {string} Season name
   */
  getCurrentSeason(date) {
    const month = date.getMonth();

    for (const [season, definition] of Object.entries(
      this.config.seasonDefinitions,
    )) {
      if (definition.months.includes(month)) {
        return season;
      }
    }

    return "unknown";
  }

  /**
   * Get seasonal context
   * @param {string} season - Season name
   * @param {Date} date - Current date
   * @returns {Object} Seasonal context
   */
  getSeasonalContext(season, date) {
    const definition = this.config.seasonDefinitions[season];

    return {
      season,
      characteristics: definition?.characteristics || [],
      isTransitionPeriod: this.isSeasonTransitionPeriod(date),
      dayOfSeason: this.getDayOfSeason(date, season),
      weekOfSeason: this.getWeekOfSeason(date, season),
      isHolidaySeason: this.isHolidaySeason(date),
    };
  }

  /**
   * Analyze upcoming holidays in date range
   * @param {Array} dateRange - Date range to analyze
   * @returns {Array} Upcoming holidays
   */
  analyzeUpcomingHolidays(dateRange) {
    const upcomingHolidays = [];

    dateRange.forEach((date) => {
      const monthDay = this.formatMonthDay(date);

      if (this.holidays.has(monthDay)) {
        const holiday = this.holidays.get(monthDay);
        upcomingHolidays.push({
          date: date.toISOString().split("T")[0],
          ...holiday,
          daysFromNow: Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24)),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
        });
      }

      // Check for nearby holidays (within 3 days)
      for (let offset = -3; offset <= 3; offset++) {
        if (offset === 0) continue;

        const checkDate = new Date(date);
        checkDate.setDate(checkDate.getDate() + offset);
        const checkMonthDay = this.formatMonthDay(checkDate);

        if (this.holidays.has(checkMonthDay)) {
          const holiday = this.holidays.get(checkMonthDay);
          upcomingHolidays.push({
            date: date.toISOString().split("T")[0],
            name: `Near ${holiday.name}`,
            type: "holiday_proximity",
            impact: holiday.impact === "high" ? "medium" : "low",
            staffingAdjustment: holiday.staffingAdjustment * 0.3,
            offset,
            originalHoliday: holiday.name,
          });
        }
      }
    });

    // Remove duplicates and sort by date
    const uniqueHolidays = upcomingHolidays.filter(
      (holiday, index, array) =>
        array.findIndex(
          (h) => h.date === holiday.date && h.name === holiday.name,
        ) === index,
    );

    return uniqueHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  /**
   * Generate demand forecast for date range
   * @param {Array} dateRange - Date range
   * @param {string} season - Current season
   * @returns {Object} Demand forecast
   */
  async generateDemandForecast(dateRange, season) {
    const forecast = {
      trend: "stable",
      averageDemand: 1.0,
      peakDays: [],
      lowDays: [],
      confidence: 0.6,
    };

    // Get seasonal demand model
    const demandModel = this.demandForecasts.get(season);
    const seasonalPatterns = this.seasonalPatterns.get(season);

    if (demandModel && seasonalPatterns) {
      // Calculate demand for each day
      const dailyForecasts = dateRange.map((date) => {
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let demandFactor = seasonalPatterns.demandPatterns?.overall || 1.0;

        // Apply weekend/weekday adjustment
        if (isWeekend) {
          demandFactor *= seasonalPatterns.demandPatterns?.weekends || 1.2;
        } else {
          demandFactor *= seasonalPatterns.demandPatterns?.weekdays || 0.9;
        }

        // Check for holiday impact
        const monthDay = this.formatMonthDay(date);
        if (this.holidays.has(monthDay)) {
          const holiday = this.holidays.get(monthDay);
          demandFactor *= 1 + holiday.staffingAdjustment;
        }

        return {
          date: date.toISOString().split("T")[0],
          demandFactor,
          isWeekend,
          dayOfWeek,
        };
      });

      // Analyze forecast
      const averageDemand =
        dailyForecasts.reduce((sum, f) => sum + f.demandFactor, 0) /
        dailyForecasts.length;
      const maxDemand = Math.max(...dailyForecasts.map((f) => f.demandFactor));
      const minDemand = Math.min(...dailyForecasts.map((f) => f.demandFactor));

      forecast.averageDemand = averageDemand;
      forecast.trend =
        averageDemand > 1.1
          ? "increasing"
          : averageDemand < 0.9
            ? "decreasing"
            : "stable";
      forecast.peakDays = dailyForecasts
        .filter((f) => f.demandFactor > averageDemand * 1.2)
        .map((f) => f.date);
      forecast.lowDays = dailyForecasts
        .filter((f) => f.demandFactor < averageDemand * 0.8)
        .map((f) => f.date);
      forecast.confidence = demandModel.confidence || 0.6;
      forecast.dailyForecasts = dailyForecasts;
    }

    return forecast;
  }

  /**
   * Calculate seasonal adjustments
   * @param {string} season - Current season
   * @param {Array} upcomingHolidays - Upcoming holidays
   * @returns {Object} Seasonal adjustments
   */
  calculateSeasonalAdjustments(season, upcomingHolidays) {
    const adjustments = {
      staffingLevel: 1.0,
      shiftDistribution: { early: 0.2, normal: 0.6, late: 0.2 },
      dayOffAllowance: 0.25,
      constraintFlexibility: 0.0,
      workloadBalance: 1.0,
    };

    // Apply seasonal base adjustments
    const seasonalPatterns = this.seasonalPatterns.get(season);
    if (seasonalPatterns) {
      adjustments.staffingLevel =
        seasonalPatterns.staffingPatterns?.preferred || 1.0;
      adjustments.shiftDistribution =
        seasonalPatterns.shiftDistributions || adjustments.shiftDistribution;
      adjustments.workloadBalance =
        seasonalPatterns.workloadFactors?.base || 1.0;
    }

    // Apply holiday adjustments
    const highImpactHolidays = upcomingHolidays.filter(
      (h) => h.impact === "high",
    );
    if (highImpactHolidays.length > 0) {
      adjustments.dayOffAllowance += 0.1; // More flexible day-off allowance
      adjustments.constraintFlexibility += 0.15; // More flexible constraints
    }

    const mediumImpactHolidays = upcomingHolidays.filter(
      (h) => h.impact === "medium",
    );
    if (mediumImpactHolidays.length > 0) {
      adjustments.dayOffAllowance += 0.05;
      adjustments.constraintFlexibility += 0.1;
    }

    return adjustments;
  }

  /**
   * Apply holiday-based adaptations
   * @param {Object} schedule - Schedule to adapt
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Array} holidays - Holidays to consider
   * @returns {Array} Applied adaptations
   */
  async applyHolidayAdaptations(schedule, staffMembers, dateRange, holidays) {
    const adaptations = [];

    holidays.forEach((holiday) => {
      if (holiday.impact === "high" || holiday.impact === "medium") {
        const dateKey = holiday.date;

        // Calculate how many staff should have the day off
        const totalStaff = staffMembers.length;
        const recommendedDaysOff = Math.ceil(
          totalStaff * Math.abs(holiday.staffingAdjustment),
        );

        // Count current days off
        let currentDaysOff = 0;
        staffMembers.forEach((staff) => {
          const staffSchedule = schedule[staff.id] || {};
          if (staffSchedule[dateKey] === "×") {
            currentDaysOff++;
          }
        });

        // Apply adjustment if needed
        if (currentDaysOff < recommendedDaysOff) {
          const additionalDaysOff = recommendedDaysOff - currentDaysOff;

          // Select staff for additional days off (simplified selection)
          let adjusted = 0;
          staffMembers.forEach((staff) => {
            if (adjusted >= additionalDaysOff) return;

            const staffSchedule = schedule[staff.id] || {};
            if (staffSchedule[dateKey] && staffSchedule[dateKey] !== "×") {
              staffSchedule[dateKey] = "×";
              adaptations.push({
                type: "holiday_day_off",
                staffId: staff.id,
                staffName: staff.name,
                date: dateKey,
                holiday: holiday.name,
                reason: `Holiday adaptation for ${holiday.name}`,
                impact: holiday.impact,
              });
              adjusted++;
            }
          });
        }
      }
    });

    return adaptations;
  }

  /**
   * Apply demand-based adaptations
   * @param {Object} schedule - Schedule to adapt
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} demandForecast - Demand forecast
   * @returns {Array} Applied adaptations
   */
  async applyDemandBasedAdaptations(
    schedule,
    staffMembers,
    dateRange,
    demandForecast,
  ) {
    const adaptations = [];

    if (demandForecast.dailyForecasts) {
      demandForecast.dailyForecasts.forEach((forecast) => {
        const dateKey = forecast.date;

        // Apply shift distribution adjustments for high demand days
        if (forecast.demandFactor > 1.3) {
          // Increase normal and late shifts, reduce early shifts
          staffMembers.forEach((staff) => {
            const staffSchedule = schedule[staff.id] || {};

            if (staffSchedule[dateKey] === "△") {
              // Convert some early shifts to normal shifts
              if (Math.random() < 0.3) {
                // 30% chance
                staffSchedule[dateKey] = "○";
                adaptations.push({
                  type: "demand_shift_adjustment",
                  staffId: staff.id,
                  staffName: staff.name,
                  date: dateKey,
                  from: "△",
                  to: "○",
                  reason: "High demand day - increase coverage",
                  demandFactor: forecast.demandFactor,
                });
              }
            }
          });
        }

        // Apply adjustments for low demand days
        if (forecast.demandFactor < 0.7) {
          // Increase early shifts or days off
          staffMembers.forEach((staff) => {
            const staffSchedule = schedule[staff.id] || {};

            if (
              staffSchedule[dateKey] === "○" ||
              staffSchedule[dateKey] === "▽"
            ) {
              // Convert some shifts to early or day off
              if (Math.random() < 0.2) {
                // 20% chance
                const newShift = Math.random() < 0.7 ? "△" : "×";
                const oldShift = staffSchedule[dateKey];
                staffSchedule[dateKey] = newShift;
                adaptations.push({
                  type: "demand_shift_adjustment",
                  staffId: staff.id,
                  staffName: staff.name,
                  date: dateKey,
                  from: oldShift,
                  to: newShift,
                  reason: "Low demand day - optimize staffing",
                  demandFactor: forecast.demandFactor,
                });
              }
            }
          });
        }
      });
    }

    return adaptations;
  }

  /**
   * Apply pattern-based adaptations
   * @param {Object} schedule - Schedule to adapt
   * @param {Array} staffMembers - Staff members
   * @param {Array} dateRange - Date range
   * @param {Object} patterns - Seasonal patterns
   * @returns {Array} Applied adaptations
   */
  async applyPatternAdaptations(schedule, staffMembers, dateRange, patterns) {
    const adaptations = [];

    // Apply shift distribution patterns
    if (patterns.shiftDistribution) {
      const targetDistribution = patterns.shiftDistribution;

      // Calculate current distribution
      const currentDistribution = this.calculateCurrentShiftDistribution(
        schedule,
        dateRange,
      );

      // Apply adjustments to match target distribution
      Object.entries(targetDistribution).forEach(([shiftType, targetRatio]) => {
        const shiftSymbol = this.getShiftSymbol(shiftType);
        const currentRatio = currentDistribution[shiftSymbol] || 0;

        if (Math.abs(currentRatio - targetRatio) > 0.1) {
          // Apply gradual adjustment
          const adjustmentNeeded = targetRatio - currentRatio;

          adaptations.push({
            type: "pattern_distribution_adjustment",
            shiftType,
            currentRatio,
            targetRatio,
            adjustmentNeeded,
            reason: "Seasonal pattern alignment",
          });
        }
      });
    }

    return adaptations;
  }

  // Utility methods for seasonal analysis

  groupDataBySeasons(historicalData) {
    const seasonalData = {};

    // Initialize seasonal data
    Object.keys(this.config.seasonDefinitions).forEach((season) => {
      seasonalData[season] = {};
    });

    // Group schedule data by seasons
    if (historicalData.scheduleData) {
      Object.entries(historicalData.scheduleData).forEach(
        ([monthKey, monthData]) => {
          const monthIndex = parseInt(monthKey.split("-")[1]) || 0;
          const season = this.getSeasonFromMonth(monthIndex);

          if (seasonalData[season]) {
            seasonalData[season][monthKey] = monthData;
          }
        },
      );
    }

    return seasonalData;
  }

  getSeasonFromMonth(monthIndex) {
    const month = monthIndex; // Already 0-based

    for (const [season, definition] of Object.entries(
      this.config.seasonDefinitions,
    )) {
      if (definition.months.includes(month)) {
        return season;
      }
    }

    return "unknown";
  }

  calculateAverageStaffing(seasonalData) {
    const staffingCounts = [];

    Object.values(seasonalData).forEach((monthData) => {
      Object.values(monthData).forEach((staffSchedule) => {
        const workDays = Object.values(staffSchedule).filter(
          (shift) => shift !== "×",
        ).length;
        staffingCounts.push(workDays);
      });
    });

    return staffingCounts.length > 0
      ? staffingCounts.reduce((sum, count) => sum + count, 0) /
          staffingCounts.length
      : 0;
  }

  calculateShiftDistribution(seasonalData) {
    const shiftCounts = { "△": 0, "○": 0, "▽": 0, "×": 0 };
    let totalShifts = 0;

    Object.values(seasonalData).forEach((monthData) => {
      Object.values(monthData).forEach((staffSchedule) => {
        Object.values(staffSchedule).forEach((shift) => {
          if (shiftCounts[shift] !== undefined) {
            shiftCounts[shift]++;
            totalShifts++;
          }
        });
      });
    });

    // Convert to ratios
    const distribution = {};
    Object.entries(shiftCounts).forEach(([shift, count]) => {
      distribution[shift] = totalShifts > 0 ? count / totalShifts : 0;
    });

    return distribution;
  }

  calculateWorkloadPatterns(seasonalData) {
    const workloads = [];

    Object.values(seasonalData).forEach((monthData) => {
      Object.values(monthData).forEach((staffSchedule) => {
        const workDays = Object.values(staffSchedule).filter(
          (shift) => shift !== "×",
        ).length;
        const totalDays = Object.keys(staffSchedule).length;

        if (totalDays > 0) {
          workloads.push(workDays / totalDays);
        }
      });
    });

    if (workloads.length === 0) return { average: 0, variance: 0 };

    const average =
      workloads.reduce((sum, workload) => sum + workload, 0) / workloads.length;
    const variance =
      workloads.reduce(
        (sum, workload) => sum + Math.pow(workload - average, 2),
        0,
      ) / workloads.length;

    return { average, variance, standardDeviation: Math.sqrt(variance) };
  }

  calculateDayOffPatterns(seasonalData) {
    const dayOffsByDayOfWeek = Array(7).fill(0);
    let totalDaysOff = 0;

    Object.values(seasonalData).forEach((monthData) => {
      Object.values(monthData).forEach((staffSchedule) => {
        Object.entries(staffSchedule).forEach(([dateKey, shift]) => {
          if (shift === "×") {
            const date = new Date(dateKey);
            const dayOfWeek = date.getDay();
            dayOffsByDayOfWeek[dayOfWeek]++;
            totalDaysOff++;
          }
        });
      });
    });

    // Convert to ratios
    const patterns = dayOffsByDayOfWeek.map((count) =>
      totalDaysOff > 0 ? count / totalDaysOff : 0,
    );

    return {
      byDayOfWeek: patterns,
      weekendRatio: patterns[0] + patterns[6], // Sunday + Saturday
      weekdayRatio: patterns.slice(1, 6).reduce((sum, ratio) => sum + ratio, 0),
    };
  }

  calculateWeeklyPatterns(seasonalData) {
    // Simplified weekly pattern calculation
    return {
      averageWorkDaysPerWeek: 5.2,
      weekendWorkRatio: 0.3,
      peakDays: [0, 6], // Sunday and Saturday
      quietDays: [1, 2], // Monday and Tuesday
    };
  }

  calculatePatternConfidence(seasonalData) {
    // Calculate confidence based on data quantity and consistency
    const dataPoints = Object.keys(seasonalData).length;

    if (dataPoints >= 6) return 0.9; // 6+ months of data
    if (dataPoints >= 3) return 0.7; // 3-5 months of data
    if (dataPoints >= 1) return 0.5; // 1-2 months of data
    return 0.2; // Very limited data
  }

  calculatePatternAccuracy(seasonalAnalysis) {
    // Simplified accuracy calculation based on pattern consistency
    let totalAccuracy = 0;
    let patternCount = 0;

    Object.values(seasonalAnalysis).forEach((patterns) => {
      totalAccuracy += patterns.confidence || 0.5;
      patternCount++;
    });

    return patternCount > 0 ? (totalAccuracy / patternCount) * 100 : 50;
  }

  calculateOverallConfidence() {
    const seasonConfidences = [];

    this.seasonalPatterns.forEach((patterns) => {
      seasonConfidences.push(patterns.confidence || 0.5);
    });

    return seasonConfidences.length > 0
      ? seasonConfidences.reduce((sum, conf) => sum + conf, 0) /
          seasonConfidences.length
      : 0.5;
  }

  generateSeasonalRecommendations(seasonalAnalysis) {
    const recommendations = [];

    Object.entries(seasonalAnalysis).forEach(([season, patterns]) => {
      if (patterns.confidence < 0.6) {
        recommendations.push({
          type: "data_collection",
          season,
          priority: "medium",
          description: `Collect more data for ${season} to improve pattern accuracy`,
          targetConfidence: 0.8,
        });
      }

      if (patterns.workloadPatterns?.variance > 0.2) {
        recommendations.push({
          type: "workload_balancing",
          season,
          priority: "high",
          description: `High workload variance in ${season} - consider better distribution`,
          currentVariance: patterns.workloadPatterns.variance,
        });
      }
    });

    return recommendations;
  }

  // Additional utility methods

  formatMonthDay(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}-${day}`;
  }

  isSeasonTransitionPeriod(date) {
    const month = date.getMonth();
    const day = date.getDate();

    // Check if within 2 weeks of season change
    return (
      (month === 2 && day >= 15) || // Late February
      (month === 5 && day >= 15) || // Late May
      (month === 8 && day >= 15) || // Late August
      (month === 11 && day >= 15)
    ); // Late November
  }

  getDayOfSeason(date, season) {
    const seasonStart = this.getSeasonStartDate(date.getFullYear(), season);
    return Math.ceil((date - seasonStart) / (1000 * 60 * 60 * 24));
  }

  getWeekOfSeason(date, season) {
    return Math.ceil(this.getDayOfSeason(date, season) / 7);
  }

  isHolidaySeason(date) {
    const month = date.getMonth();
    return month === 11 || month === 0 || month === 1; // December, January, February
  }

  getSeasonStartDate(year, season) {
    const seasonStarts = {
      spring: new Date(year, 2, 1), // March 1
      summer: new Date(year, 5, 1), // June 1
      fall: new Date(year, 8, 1), // September 1
      winter: new Date(year, 11, 1), // December 1
    };

    return seasonStarts[season] || new Date(year, 0, 1);
  }

  calculateAdaptationScore(adaptations) {
    if (adaptations.length === 0) return 0;

    const impactScores = adaptations.map((adaptation) => {
      switch (adaptation.type) {
        case "holiday_day_off":
          return adaptation.impact === "high" ? 10 : 5;
        case "demand_shift_adjustment":
          return Math.abs(adaptation.demandFactor - 1) * 10;
        case "pattern_distribution_adjustment":
          return Math.abs(adaptation.adjustmentNeeded) * 20;
        default:
          return 5;
      }
    });

    const totalScore = impactScores.reduce((sum, score) => sum + score, 0);
    return Math.min(100, totalScore);
  }

  getCurrentPatterns() {
    // Simplified - would analyze real-time data
    return {
      demand: 1.0,
      staffing: 0.85,
      shiftDistribution: { early: 0.2, normal: 0.6, late: 0.2 },
    };
  }

  calculateDeviation(actual, expected) {
    return expected !== 0 ? (actual - expected) / expected : 0;
  }

  generateCurrentSeasonRecommendations(season, holidays, demandForecast) {
    const recommendations = [];

    if (holidays.length > 2) {
      recommendations.push({
        type: "holiday_preparation",
        priority: "high",
        description: `Prepare for ${holidays.length} upcoming holidays in ${season}`,
        suggestedActions: [
          "Review staff availability",
          "Plan coverage adjustments",
          "Communicate schedule changes early",
        ],
      });
    }

    if (demandForecast.trend === "increasing") {
      recommendations.push({
        type: "demand_increase",
        priority: "medium",
        description: "Increasing demand trend detected",
        suggestedActions: [
          "Consider additional staffing",
          "Optimize shift distributions",
          "Monitor coverage closely",
        ],
      });
    }

    return recommendations;
  }

  /**
   * Get seasonal analyzer status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      version: this.version,
      seasonalPatterns: this.seasonalPatterns.size,
      holidayPatterns: this.holidayPatterns.size,
      demandForecasts: this.demandForecasts.size,
      historicalSeasons: this.historicalSeasons.length,
      metrics: { ...this.metrics },
      config: this.config,
    };
  }

  /**
   * Reset the seasonal analyzer
   * @returns {Object} Reset result
   */
  async reset() {
    console.log("🔄 Resetting Seasonal Analyzer...");

    try {
      this.initialized = false;
      this.seasonalPatterns.clear();
      this.holidayPatterns.clear();
      this.demandForecasts.clear();
      this.historicalSeasons = [];

      // Reset recognized patterns
      this.recognizedPatterns = {
        seasonal: {},
        weekly: {},
        monthly: {},
        holiday: {},
        special: {},
      };

      // Reset metrics
      this.metrics = {
        patternAccuracy: 0,
        forecastAccuracy: 0,
        adaptationSuccess: 0,
        holidayPredictionAccuracy: 0,
        demandForecastMAPE: 0,
        totalAnalyses: 0,
        successfulAdaptations: 0,
      };

      console.log("✅ Seasonal Analyzer reset successfully");

      return {
        success: true,
        message: "Seasonal Analyzer reset successfully",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Seasonal Analyzer reset failed:", error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
