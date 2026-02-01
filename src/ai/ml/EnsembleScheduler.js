/**
 * EnsembleScheduler.js (DEPRECATED - OR-Tools Now Primary)
 *
 * This module is kept for backward compatibility only.
 * The application now uses OR-Tools via WebSocket for schedule optimization.
 */

export class EnsembleScheduler {
  constructor() {
    this.models = new Map();
    this.isInitialized = false;
    console.log("[EnsembleScheduler] DEPRECATED: Use OR-Tools via WebSocket instead");
  }

  async initialize() {
    this.isInitialized = true;
    return true;
  }

  async generateSchedule() {
    console.warn("[EnsembleScheduler] generateSchedule() is deprecated - use useAIAssistantLazy with OR-Tools");
    return {};
  }

  async predict() {
    return { shift: "○", confidence: 0.9 };
  }

  dispose() {
    this.models.clear();
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      type: "ortools",
      message: "OR-Tools is now the primary optimizer",
    };
  }
}

export const ensembleScheduler = new EnsembleScheduler();
export default EnsembleScheduler;
