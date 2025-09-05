import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../utils/supabase";

// Multi-user collaboration system with presence and real-time cursors
export const useCollaboration = (scheduleId, userId, options = {}) => {
  const queryClient = useQueryClient();
  const [activeUsers, setActiveUsers] = useState(new Map());
  const [userCursors, setUserCursors] = useState(new Map());
  const [editingLocks, setEditingLocks] = useState(new Map());
  const [collaborationStatus, setCollaborationStatus] =
    useState("disconnected");
  const [lastActivity, setLastActivity] = useState(null);

  const presenceChannelRef = useRef(null);
  const cursorChannelRef = useRef(null);
  const lockChannelRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const cursorDebounceRef = useRef(null);

  const currentUser = {
    id: userId || `user-${Date.now()}`,
    name: options.userName || "Anonymous User",
    avatar: options.userAvatar || null,
    color: options.userColor || generateUserColor(userId),
    joinedAt: Date.now(),
  };

  // Initialize collaboration channels
  useEffect(() => {
    if (!scheduleId) return;

    initializeCollaboration();

    return () => {
      cleanup();
    };
  }, [scheduleId, userId]);

  // Initialize real-time collaboration
  const initializeCollaboration = useCallback(async () => {
    try {
      setCollaborationStatus("connecting");

      // Set up presence channel for user awareness
      presenceChannelRef.current = supabase.channel(`presence:${scheduleId}`, {
        config: {
          presence: {
            key: currentUser.id,
          },
        },
      });

      // Set up cursor tracking channel
      cursorChannelRef.current = supabase.channel(`cursors:${scheduleId}`);

      // Set up editing locks channel
      lockChannelRef.current = supabase.channel(`locks:${scheduleId}`);

      await setupPresenceTracking();
      await setupCursorTracking();
      await setupEditingLocks();

      setCollaborationStatus("connected");
      console.log("✅ Collaboration initialized for schedule:", scheduleId);

      // Start heartbeat
      startHeartbeat();
    } catch (error) {
      console.error("❌ Failed to initialize collaboration:", error);
      setCollaborationStatus("error");
    }
  }, [scheduleId, currentUser]);

  // Set up presence tracking
  const setupPresenceTracking = useCallback(async () => {
    const channel = presenceChannelRef.current;
    if (!channel) return;

    // Track when users join/leave
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = new Map();

        Object.entries(state).forEach(([key, presence]) => {
          const user = presence[0];
          if (user && user.user_id !== currentUser.id) {
            users.set(user.user_id, {
              id: user.user_id,
              name: user.name,
              avatar: user.avatar,
              color: user.color,
              joinedAt: user.joined_at,
              lastSeen: Date.now(),
              isActive: true,
            });
          }
        });

        setActiveUsers(users);
        console.log(`👥 Active users updated: ${users.size} users`);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        const user = newPresences[0];
        if (user && user.user_id !== currentUser.id) {
          console.log("👋 User joined:", user.name);
          if (options.onUserJoin) {
            options.onUserJoin(user);
          }
        }
      })
      .on("presence", { event: "leave" }, ({ key, leftPresences }) => {
        const user = leftPresences[0];
        if (user && user.user_id !== currentUser.id) {
          console.log("👋 User left:", user.name);
          if (options.onUserLeave) {
            options.onUserLeave(user);
          }
        }
      });

    // Join the presence channel with current user info
    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          color: currentUser.color,
          joined_at: currentUser.joinedAt,
          online_at: Date.now(),
        });
      }
    });
  }, [currentUser, options]);

  // Set up cursor tracking
  const setupCursorTracking = useCallback(async () => {
    const channel = cursorChannelRef.current;
    if (!channel) return;

    // Listen for cursor updates from other users
    channel
      .on("broadcast", { event: "cursor-move" }, (payload) => {
        const { user_id, cursor_data } = payload;
        if (user_id !== currentUser.id) {
          setUserCursors(
            (prev) =>
              new Map(
                prev.set(user_id, {
                  ...cursor_data,
                  lastUpdate: Date.now(),
                }),
              ),
          );
        }
      })
      .on("broadcast", { event: "cursor-leave" }, (payload) => {
        const { user_id } = payload;
        if (user_id !== currentUser.id) {
          setUserCursors((prev) => {
            const newCursors = new Map(prev);
            newCursors.delete(user_id);
            return newCursors;
          });
        }
      });

    await channel.subscribe();
  }, [currentUser]);

  // Set up editing locks
  const setupEditingLocks = useCallback(async () => {
    const channel = lockChannelRef.current;
    if (!channel) return;

    // Listen for lock events
    channel
      .on("broadcast", { event: "cell-lock" }, (payload) => {
        const { user_id, staff_id, date_key, lock_id } = payload;
        if (user_id !== currentUser.id) {
          const lockKey = `${staff_id}:${date_key}`;
          setEditingLocks(
            (prev) =>
              new Map(
                prev.set(lockKey, {
                  userId: user_id,
                  lockId: lock_id,
                  timestamp: Date.now(),
                  staffId: staff_id,
                  dateKey: date_key,
                }),
              ),
          );
        }
      })
      .on("broadcast", { event: "cell-unlock" }, (payload) => {
        const { user_id, staff_id, date_key } = payload;
        const lockKey = `${staff_id}:${date_key}`;
        setEditingLocks((prev) => {
          const newLocks = new Map(prev);
          newLocks.delete(lockKey);
          return newLocks;
        });
      })
      .on("broadcast", { event: "bulk-unlock" }, (payload) => {
        const { user_id } = payload;
        if (user_id !== currentUser.id) {
          setEditingLocks((prev) => {
            const newLocks = new Map();
            prev.forEach((lock, key) => {
              if (lock.userId !== user_id) {
                newLocks.set(key, lock);
              }
            });
            return newLocks;
          });
        }
      });

    await channel.subscribe();
  }, [currentUser]);

  // Update cursor position
  const updateCursor = useCallback(
    (position) => {
      if (!cursorChannelRef.current || collaborationStatus !== "connected")
        return;

      // Debounce cursor updates to avoid flooding
      if (cursorDebounceRef.current) {
        clearTimeout(cursorDebounceRef.current);
      }

      cursorDebounceRef.current = setTimeout(() => {
        cursorChannelRef.current.send({
          type: "broadcast",
          event: "cursor-move",
          user_id: currentUser.id,
          cursor_data: {
            x: position.x,
            y: position.y,
            staffId: position.staffId,
            dateKey: position.dateKey,
            element: position.element,
            userName: currentUser.name,
            userColor: currentUser.color,
          },
        });
      }, 50); // 50ms debounce

      setLastActivity(Date.now());
    },
    [collaborationStatus, currentUser],
  );

  // Remove cursor when leaving
  const removeCursor = useCallback(() => {
    if (!cursorChannelRef.current) return;

    cursorChannelRef.current.send({
      type: "broadcast",
      event: "cursor-leave",
      user_id: currentUser.id,
    });
  }, [currentUser]);

  // Lock a cell for editing
  const lockCell = useCallback(
    async (staffId, dateKey) => {
      if (!lockChannelRef.current || collaborationStatus !== "connected")
        return null;

      const lockKey = `${staffId}:${dateKey}`;

      // Check if already locked by another user
      const existingLock = editingLocks.get(lockKey);
      if (existingLock && existingLock.userId !== currentUser.id) {
        return {
          success: false,
          locked: true,
          lockedBy: activeUsers.get(existingLock.userId),
        };
      }

      const lockId = `lock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      try {
        await lockChannelRef.current.send({
          type: "broadcast",
          event: "cell-lock",
          user_id: currentUser.id,
          staff_id: staffId,
          date_key: dateKey,
          lock_id: lockId,
        });

        // Update local state
        setEditingLocks(
          (prev) =>
            new Map(
              prev.set(lockKey, {
                userId: currentUser.id,
                lockId,
                timestamp: Date.now(),
                staffId,
                dateKey,
              }),
            ),
        );

        setLastActivity(Date.now());

        return {
          success: true,
          lockId,
        };
      } catch (error) {
        console.error("❌ Failed to lock cell:", error);
        return {
          success: false,
          error: error.message,
        };
      }
    },
    [collaborationStatus, currentUser, editingLocks, activeUsers],
  );

  // Unlock a cell
  const unlockCell = useCallback(
    async (staffId, dateKey) => {
      if (!lockChannelRef.current) return;

      const lockKey = `${staffId}:${dateKey}`;
      const lock = editingLocks.get(lockKey);

      if (lock && lock.userId === currentUser.id) {
        try {
          await lockChannelRef.current.send({
            type: "broadcast",
            event: "cell-unlock",
            user_id: currentUser.id,
            staff_id: staffId,
            date_key: dateKey,
          });

          // Update local state
          setEditingLocks((prev) => {
            const newLocks = new Map(prev);
            newLocks.delete(lockKey);
            return newLocks;
          });

          setLastActivity(Date.now());
        } catch (error) {
          console.error("❌ Failed to unlock cell:", error);
        }
      }
    },
    [currentUser, editingLocks],
  );

  // Unlock all cells for current user
  const unlockAllCells = useCallback(async () => {
    if (!lockChannelRef.current) return;

    try {
      await lockChannelRef.current.send({
        type: "broadcast",
        event: "bulk-unlock",
        user_id: currentUser.id,
      });

      // Clear all locks for current user
      setEditingLocks((prev) => {
        const newLocks = new Map();
        prev.forEach((lock, key) => {
          if (lock.userId !== currentUser.id) {
            newLocks.set(key, lock);
          }
        });
        return newLocks;
      });
    } catch (error) {
      console.error("❌ Failed to unlock all cells:", error);
    }
  }, [currentUser]);

  // Check if a cell is locked by another user
  const isCellLocked = useCallback(
    (staffId, dateKey) => {
      const lockKey = `${staffId}:${dateKey}`;
      const lock = editingLocks.get(lockKey);
      return lock && lock.userId !== currentUser.id ? lock : null;
    },
    [editingLocks, currentUser],
  );

  // Start heartbeat to maintain presence
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(async () => {
      if (presenceChannelRef.current && collaborationStatus === "connected") {
        try {
          await presenceChannelRef.current.track({
            user_id: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar,
            color: currentUser.color,
            joined_at: currentUser.joinedAt,
            online_at: Date.now(),
          });
        } catch (error) {
          console.warn("⚠️ Heartbeat failed:", error);
        }
      }
    }, 30000); // Every 30 seconds
  }, [collaborationStatus, currentUser]);

  // Cleanup collaboration resources
  const cleanup = useCallback(() => {
    console.log("🧹 Cleaning up collaboration");

    // Clear intervals
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (cursorDebounceRef.current) {
      clearTimeout(cursorDebounceRef.current);
      cursorDebounceRef.current = null;
    }

    // Unlock all cells before leaving
    unlockAllCells();

    // Remove cursor
    removeCursor();

    // Unsubscribe from channels
    if (presenceChannelRef.current) {
      presenceChannelRef.current.unsubscribe();
      presenceChannelRef.current = null;
    }

    if (cursorChannelRef.current) {
      cursorChannelRef.current.unsubscribe();
      cursorChannelRef.current = null;
    }

    if (lockChannelRef.current) {
      lockChannelRef.current.unsubscribe();
      lockChannelRef.current = null;
    }

    // Reset state
    setActiveUsers(new Map());
    setUserCursors(new Map());
    setEditingLocks(new Map());
    setCollaborationStatus("disconnected");
  }, [unlockAllCells, removeCursor]);

  // Clean up old cursors and inactive users
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 10000; // 10 seconds

      // Clean up old cursors
      setUserCursors((prev) => {
        const newCursors = new Map();
        prev.forEach((cursor, userId) => {
          if (now - cursor.lastUpdate < timeout) {
            newCursors.set(userId, cursor);
          }
        });
        return newCursors;
      });

      // Clean up old locks (safety measure)
      setEditingLocks((prev) => {
        const newLocks = new Map();
        prev.forEach((lock, key) => {
          if (now - lock.timestamp < 60000) {
            // 1 minute timeout
            newLocks.set(key, lock);
          }
        });
        return newLocks;
      });
    }, 5000); // Every 5 seconds

    return () => clearInterval(cleanupInterval);
  }, []);

  // Get collaboration statistics
  const getCollaborationStats = useCallback(() => {
    return {
      activeUsers: activeUsers.size,
      activeCursors: userCursors.size,
      activeLocks: editingLocks.size,
      status: collaborationStatus,
      lastActivity: lastActivity,
      currentUser: currentUser,
    };
  }, [
    activeUsers,
    userCursors,
    editingLocks,
    collaborationStatus,
    lastActivity,
    currentUser,
  ]);

  return {
    // State
    activeUsers,
    userCursors,
    editingLocks,
    collaborationStatus,
    currentUser,
    lastActivity,

    // Cursor functions
    updateCursor,
    removeCursor,

    // Lock functions
    lockCell,
    unlockCell,
    unlockAllCells,
    isCellLocked,

    // Utilities
    getCollaborationStats,
    cleanup,

    // Computed values
    userCount: activeUsers.size + 1, // +1 for current user
    hasActiveCursors: userCursors.size > 0,
    hasActiveLocks: editingLocks.size > 0,
    isConnected: collaborationStatus === "connected",
  };
};

// Generate a consistent color for a user ID
function generateUserColor(userId) {
  if (!userId) return "#6B7280";

  const colors = [
    "#EF4444",
    "#F97316",
    "#F59E0B",
    "#EAB308",
    "#84CC16",
    "#22C55E",
    "#10B981",
    "#14B8A6",
    "#06B6D4",
    "#0EA5E9",
    "#3B82F6",
    "#6366F1",
    "#8B5CF6",
    "#A855F7",
    "#D946EF",
    "#EC4899",
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) & 0xffffffff;
  }

  return colors[Math.abs(hash) % colors.length];
}

export default useCollaboration;
