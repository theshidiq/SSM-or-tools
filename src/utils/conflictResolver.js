/**
 * Conflict Resolution System for Phase 2
 * Handles multi-user editing conflicts with sophisticated resolution strategies
 */

import React from "react";

// Conflict types
export const CONFLICT_TYPES = {
  CONCURRENT_EDIT: "concurrent_edit",
  VERSION_MISMATCH: "version_mismatch",
  DELETE_MODIFIED: "delete_modified",
  MODIFY_DELETED: "modify_deleted",
};

// Resolution strategies
export const RESOLUTION_STRATEGIES = {
  LAST_WRITER_WINS: "last_writer_wins",
  FIRST_WRITER_WINS: "first_writer_wins",
  MERGE_CHANGES: "merge_changes",
  USER_CHOICE: "user_choice",
  AUTOMATIC_MERGE: "automatic_merge",
};

/**
 * Main conflict resolver class
 */
export class ConflictResolver {
  constructor(options = {}) {
    this.defaultStrategy =
      options.defaultStrategy || RESOLUTION_STRATEGIES.LAST_WRITER_WINS;
    this.enableUserChoice = options.enableUserChoice !== false;
    this.mergeTimeout = options.mergeTimeout || 30000; // 30 seconds
    this.conflictLog = [];
  }

  /**
   * Detect conflicts between local and remote changes
   */
  detectConflict(localChange, remoteChange) {
    // No conflict if one of the changes is null/undefined
    if (!localChange || !remoteChange) {
      return null;
    }

    const conflict = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      local: localChange,
      remote: remoteChange,
      type: this._determineConflictType(localChange, remoteChange),
      metadata: {
        localTimestamp: localChange.timestamp,
        remoteTimestamp: remoteChange.timestamp,
        staffId: localChange.staffId || remoteChange.staffId,
        dateKey: localChange.dateKey || remoteChange.dateKey,
      },
    };

    console.warn("🔥 Conflict detected:", conflict);
    this.conflictLog.push(conflict);

    return conflict;
  }

  /**
   * Resolve a conflict using the specified strategy
   */
  async resolveConflict(
    conflict,
    strategy = this.defaultStrategy,
    userChoice = null,
  ) {
    try {
      console.log(
        `🔧 Resolving conflict ${conflict.id} using strategy: ${strategy}`,
      );

      let resolution;

      switch (strategy) {
        case RESOLUTION_STRATEGIES.LAST_WRITER_WINS:
          resolution = this._resolveLastWriterWins(conflict);
          break;

        case RESOLUTION_STRATEGIES.FIRST_WRITER_WINS:
          resolution = this._resolveFirstWriterWins(conflict);
          break;

        case RESOLUTION_STRATEGIES.MERGE_CHANGES:
          resolution = await this._resolveMergeChanges(conflict);
          break;

        case RESOLUTION_STRATEGIES.USER_CHOICE:
          resolution = await this._resolveUserChoice(conflict, userChoice);
          break;

        case RESOLUTION_STRATEGIES.AUTOMATIC_MERGE:
          resolution = await this._resolveAutomaticMerge(conflict);
          break;

        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }

      resolution.resolvedAt = new Date().toISOString();
      resolution.strategy = strategy;
      resolution.conflictId = conflict.id;

      console.log(`✅ Conflict ${conflict.id} resolved:`, resolution);

      return resolution;
    } catch (error) {
      console.error(`Failed to resolve conflict ${conflict.id}:`, error);

      // Fallback to last writer wins
      if (strategy !== RESOLUTION_STRATEGIES.LAST_WRITER_WINS) {
        return this.resolveConflict(
          conflict,
          RESOLUTION_STRATEGIES.LAST_WRITER_WINS,
        );
      }

      throw error;
    }
  }

  /**
   * Determine the type of conflict
   */
  _determineConflictType(localChange, remoteChange) {
    const localTime = new Date(localChange.timestamp);
    const remoteTime = new Date(remoteChange.timestamp);
    const timeDiff = Math.abs(localTime - remoteTime);

    // Consider concurrent if within 5 seconds
    if (timeDiff < 5000) {
      return CONFLICT_TYPES.CONCURRENT_EDIT;
    }

    // Check for delete/modify conflicts
    if (
      localChange.operation === "delete" &&
      remoteChange.operation === "update"
    ) {
      return CONFLICT_TYPES.DELETE_MODIFIED;
    }

    if (
      localChange.operation === "update" &&
      remoteChange.operation === "delete"
    ) {
      return CONFLICT_TYPES.MODIFY_DELETED;
    }

    return CONFLICT_TYPES.VERSION_MISMATCH;
  }

  /**
   * Last writer wins resolution
   */
  _resolveLastWriterWins(conflict) {
    const localTime = new Date(conflict.local.timestamp);
    const remoteTime = new Date(conflict.remote.timestamp);

    const winner = localTime > remoteTime ? conflict.local : conflict.remote;
    const loser = winner === conflict.local ? conflict.remote : conflict.local;

    return {
      type: "accepted",
      acceptedChange: winner,
      rejectedChange: loser,
      reason: `${winner === conflict.local ? "Local" : "Remote"} change was more recent`,
    };
  }

  /**
   * First writer wins resolution
   */
  _resolveFirstWriterWins(conflict) {
    const localTime = new Date(conflict.local.timestamp);
    const remoteTime = new Date(conflict.remote.timestamp);

    const winner = localTime < remoteTime ? conflict.local : conflict.remote;
    const loser = winner === conflict.local ? conflict.remote : conflict.local;

    return {
      type: "accepted",
      acceptedChange: winner,
      rejectedChange: loser,
      reason: `${winner === conflict.local ? "Local" : "Remote"} change came first`,
    };
  }

  /**
   * Merge changes resolution
   */
  async _resolveMergeChanges(conflict) {
    try {
      const merged = await this._mergeChanges(conflict.local, conflict.remote);

      return {
        type: "merged",
        mergedChange: merged,
        originalLocal: conflict.local,
        originalRemote: conflict.remote,
        reason: "Changes were successfully merged",
      };
    } catch (error) {
      console.warn("Merge failed, falling back to last writer wins:", error);
      return this._resolveLastWriterWins(conflict);
    }
  }

  /**
   * User choice resolution
   */
  async _resolveUserChoice(conflict, userChoice) {
    if (userChoice) {
      const chosenChange =
        userChoice === "local" ? conflict.local : conflict.remote;
      const rejectedChange =
        userChoice === "local" ? conflict.remote : conflict.local;

      return {
        type: "user_chosen",
        acceptedChange: chosenChange,
        rejectedChange: rejectedChange,
        reason: `User chose ${userChoice} change`,
      };
    }

    // If no user choice provided, present options
    return {
      type: "needs_user_input",
      options: {
        local: conflict.local,
        remote: conflict.remote,
        merge: await this._canMerge(conflict.local, conflict.remote),
      },
      reason: "User input required for resolution",
    };
  }

  /**
   * Automatic merge resolution
   */
  async _resolveAutomaticMerge(conflict) {
    try {
      if (await this._canMerge(conflict.local, conflict.remote)) {
        return await this._resolveMergeChanges(conflict);
      } else {
        // Fall back to last writer wins if merge is not possible
        return this._resolveLastWriterWins(conflict);
      }
    } catch (error) {
      return this._resolveLastWriterWins(conflict);
    }
  }

  /**
   * Check if two changes can be merged
   */
  async _canMerge(localChange, remoteChange) {
    // Can merge if they affect different fields/properties
    if (
      localChange.field &&
      remoteChange.field &&
      localChange.field !== remoteChange.field
    ) {
      return true;
    }

    // Can merge if values are compatible
    if (this._areValuesCompatible(localChange.value, remoteChange.value)) {
      return true;
    }

    // Cannot merge if they modify the same field with incompatible values
    return false;
  }

  /**
   * Merge two changes
   */
  async _mergeChanges(localChange, remoteChange) {
    const merged = {
      ...localChange,
      timestamp: new Date().toISOString(),
      operation: "merged",
      mergedFrom: {
        local: localChange,
        remote: remoteChange,
      },
    };

    // Merge based on change type
    if (
      localChange.type === "shift_update" &&
      remoteChange.type === "shift_update"
    ) {
      // For shift updates, prefer the more recent non-empty value
      const localValue = localChange.value || "";
      const remoteValue = remoteChange.value || "";

      if (!localValue && remoteValue) {
        merged.value = remoteValue;
      } else if (localValue && !remoteValue) {
        merged.value = localValue;
      } else {
        // Both have values, use more recent
        const localTime = new Date(localChange.timestamp);
        const remoteTime = new Date(remoteChange.timestamp);
        merged.value = localTime > remoteTime ? localValue : remoteValue;
      }
    } else if (
      localChange.type === "staff_update" &&
      remoteChange.type === "staff_update"
    ) {
      // Merge staff updates by field
      merged.value = {
        ...remoteChange.value,
        ...localChange.value,
        // Keep more recent timestamp for each field
        _mergeInfo: {
          localFields: Object.keys(localChange.value || {}),
          remoteFields: Object.keys(remoteChange.value || {}),
          mergedAt: merged.timestamp,
        },
      };
    }

    return merged;
  }

  /**
   * Check if two values are compatible for merging
   */
  _areValuesCompatible(value1, value2) {
    // Empty values are compatible with anything
    if (!value1 || !value2) return true;

    // Same values are compatible
    if (value1 === value2) return true;

    // Different shift symbols are generally incompatible
    if (typeof value1 === "string" && typeof value2 === "string") {
      return false;
    }

    // Objects can potentially be merged
    if (typeof value1 === "object" && typeof value2 === "object") {
      return true;
    }

    return false;
  }

  /**
   * Get conflict history
   */
  getConflictHistory(limit = 50) {
    return this.conflictLog
      .slice(-limit)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * Get conflict statistics
   */
  getConflictStats() {
    const total = this.conflictLog.length;
    const byType = {};
    const byStrategy = {};

    this.conflictLog.forEach((conflict) => {
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
      if (conflict.resolvedStrategy) {
        byStrategy[conflict.resolvedStrategy] =
          (byStrategy[conflict.resolvedStrategy] || 0) + 1;
      }
    });

    return {
      total,
      byType,
      byStrategy,
      recent: this.conflictLog.slice(-10),
    };
  }

  /**
   * Clear conflict history
   */
  clearHistory() {
    this.conflictLog = [];
    console.log("🗑️ Conflict history cleared");
  }
}

/**
 * React hook for conflict resolution
 */
export const useConflictResolver = (options = {}) => {
  const resolverRef = React.useRef(new ConflictResolver(options));
  const [activeConflicts, setActiveConflicts] = React.useState([]);
  const [conflictStats, setConflictStats] = React.useState(null);

  const resolver = resolverRef.current;

  /**
   * Handle a new conflict
   */
  const handleConflict = React.useCallback(
    async (localChange, remoteChange, strategy) => {
      const conflict = resolver.detectConflict(localChange, remoteChange);

      if (!conflict) return null;

      setActiveConflicts((prev) => [...prev, conflict]);

      try {
        const resolution = await resolver.resolveConflict(conflict, strategy);

        // Remove from active conflicts
        setActiveConflicts((prev) => prev.filter((c) => c.id !== conflict.id));

        // Update stats
        setConflictStats(resolver.getConflictStats());

        return resolution;
      } catch (error) {
        console.error("Conflict resolution failed:", error);
        return null;
      }
    },
    [resolver],
  );

  /**
   * Resolve conflict with user choice
   */
  const resolveWithUserChoice = React.useCallback(
    async (conflictId, choice) => {
      const conflict = activeConflicts.find((c) => c.id === conflictId);
      if (!conflict) return null;

      try {
        const resolution = await resolver.resolveConflict(
          conflict,
          RESOLUTION_STRATEGIES.USER_CHOICE,
          choice,
        );

        setActiveConflicts((prev) => prev.filter((c) => c.id !== conflictId));
        setConflictStats(resolver.getConflictStats());

        return resolution;
      } catch (error) {
        console.error("User choice resolution failed:", error);
        return null;
      }
    },
    [activeConflicts, resolver],
  );

  /**
   * Get conflict history
   */
  const getHistory = React.useCallback(
    (limit) => {
      return resolver.getConflictHistory(limit);
    },
    [resolver],
  );

  React.useEffect(() => {
    setConflictStats(resolver.getConflictStats());
  }, [resolver]);

  return {
    handleConflict,
    resolveWithUserChoice,
    activeConflicts,
    conflictStats,
    getHistory,
    clearHistory: resolver.clearHistory.bind(resolver),
    resolver, // Direct access for advanced usage
  };
};

// Create global resolver instance
export const globalConflictResolver = new ConflictResolver({
  defaultStrategy: RESOLUTION_STRATEGIES.AUTOMATIC_MERGE,
  enableUserChoice: true,
});

// Development helper
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  window.conflictResolver = globalConflictResolver;
  console.log("🔧 Conflict resolver available: window.conflictResolver");
}

export default ConflictResolver;
