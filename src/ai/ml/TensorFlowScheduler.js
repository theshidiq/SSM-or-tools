/**
 * TensorFlowScheduler.js (DEPRECATED - OR-Tools Now Primary)
 *
 * This module is kept for backward compatibility only.
 * The application now uses OR-Tools via WebSocket for schedule optimization.
 * All methods return no-op stubs.
 */

export class TensorFlowScheduler {
  constructor() {
    this.isInitialized = false;
    this.isTraining = false;
    console.log("[TensorFlowScheduler] DEPRECATED: Use OR-Tools via WebSocket instead");
  }

  async initialize() {
    this.isInitialized = true;
    return true;
  }

  async trainModel() {
    console.warn("[TensorFlowScheduler] trainModel() is deprecated - OR-Tools doesn't need training");
    return { success: true, message: "OR-Tools doesn't require training" };
  }

  async generateSchedule() {
    console.warn("[TensorFlowScheduler] generateSchedule() is deprecated - use useAIAssistantLazy with OR-Tools");
    return {};
  }

  async predict() {
    return { shift: "○", confidence: 0.9 };
  }

  dispose() {}

  getModelInfo() {
    return {
      status: "ready",
      type: "ortools",
      message: "OR-Tools CP-SAT Solver (no training required)",
    };
  }
}

// Singleton instance for backward compatibility
export const tensorFlowScheduler = new TensorFlowScheduler();
export default TensorFlowScheduler;
