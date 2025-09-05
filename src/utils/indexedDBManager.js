/**
 * IndexedDB Manager for Phase 2 Offline Support
 * Provides persistent storage for shift schedule data
 */

const DB_NAME = "ShiftScheduleDB";
const DB_VERSION = 1;
const STORES = {
  SCHEDULES: "schedules",
  STAFF: "staff",
  CACHE: "cache",
  PENDING_OPERATIONS: "pendingOperations",
  SETTINGS: "settings",
};

class IndexedDBManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize IndexedDB connection
   */
  async init() {
    if (this.isInitialized && this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("Failed to open IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log("✅ IndexedDB initialized successfully");
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log("🔄 Upgrading IndexedDB schema...");

        // Create schedules store
        if (!db.objectStoreNames.contains(STORES.SCHEDULES)) {
          const scheduleStore = db.createObjectStore(STORES.SCHEDULES, {
            keyPath: "id",
          });
          scheduleStore.createIndex("period", "period", { unique: false });
          scheduleStore.createIndex("updatedAt", "updatedAt", {
            unique: false,
          });
        }

        // Create staff store
        if (!db.objectStoreNames.contains(STORES.STAFF)) {
          const staffStore = db.createObjectStore(STORES.STAFF, {
            keyPath: "id",
          });
          staffStore.createIndex("period", "period", { unique: false });
        }

        // Create cache store for performance optimization
        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE, {
            keyPath: "key",
          });
          cacheStore.createIndex("expiry", "expiry", { unique: false });
        }

        // Create pending operations store for offline support
        if (!db.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_OPERATIONS, {
            keyPath: "id",
            autoIncrement: true,
          });
          pendingStore.createIndex("timestamp", "timestamp", { unique: false });
          pendingStore.createIndex("type", "type", { unique: false });
        }

        // Create settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, {
            keyPath: "key",
          });
        }
      };
    });
  }

  /**
   * Store schedule data
   */
  async storeSchedule(scheduleData, period) {
    await this.init();

    const transaction = this.db.transaction([STORES.SCHEDULES], "readwrite");
    const store = transaction.objectStore(STORES.SCHEDULES);

    const data = {
      id: `schedule_${period}`,
      period,
      data: scheduleData,
      updatedAt: new Date().toISOString(),
      syncedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get schedule data for a period
   */
  async getSchedule(period) {
    await this.init();

    const transaction = this.db.transaction([STORES.SCHEDULES], "readonly");
    const store = transaction.objectStore(STORES.SCHEDULES);

    return new Promise((resolve, reject) => {
      const request = store.get(`schedule_${period}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store staff data
   */
  async storeStaff(staffData, period) {
    await this.init();

    const transaction = this.db.transaction([STORES.STAFF], "readwrite");
    const store = transaction.objectStore(STORES.STAFF);

    const data = {
      id: `staff_${period}`,
      period,
      data: staffData,
      updatedAt: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get staff data for a period
   */
  async getStaff(period) {
    await this.init();

    const transaction = this.db.transaction([STORES.STAFF], "readonly");
    const store = transaction.objectStore(STORES.STAFF);

    return new Promise((resolve, reject) => {
      const request = store.get(`staff_${period}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Cache management for performance
   */
  async setCache(key, data, ttlMinutes = 60) {
    await this.init();

    const transaction = this.db.transaction([STORES.CACHE], "readwrite");
    const store = transaction.objectStore(STORES.CACHE);

    const cacheData = {
      key,
      data,
      createdAt: new Date().toISOString(),
      expiry: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(cacheData);
      request.onsuccess = () => resolve(cacheData);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cached data
   */
  async getCache(key) {
    await this.init();

    const transaction = this.db.transaction([STORES.CACHE], "readonly");
    const store = transaction.objectStore(STORES.CACHE);

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache has expired
        const now = new Date().toISOString();
        if (result.expiry < now) {
          // Clean up expired cache
          this.deleteCache(key);
          resolve(null);
          return;
        }

        resolve(result.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete cached data
   */
  async deleteCache(key) {
    await this.init();

    const transaction = this.db.transaction([STORES.CACHE], "readwrite");
    const store = transaction.objectStore(STORES.CACHE);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add pending operation for offline support
   */
  async addPendingOperation(operation) {
    await this.init();

    const transaction = this.db.transaction(
      [STORES.PENDING_OPERATIONS],
      "readwrite",
    );
    const store = transaction.objectStore(STORES.PENDING_OPERATIONS);

    const opData = {
      ...operation,
      timestamp: new Date().toISOString(),
      status: "pending",
    };

    return new Promise((resolve, reject) => {
      const request = store.add(opData);
      request.onsuccess = () => resolve({ ...opData, id: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations() {
    await this.init();

    const transaction = this.db.transaction(
      [STORES.PENDING_OPERATIONS],
      "readonly",
    );
    const store = transaction.objectStore(STORES.PENDING_OPERATIONS);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove pending operation
   */
  async removePendingOperation(id) {
    await this.init();

    const transaction = this.db.transaction(
      [STORES.PENDING_OPERATIONS],
      "readwrite",
    );
    const store = transaction.objectStore(STORES.PENDING_OPERATIONS);

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up expired cache entries
   */
  async cleanExpiredCache() {
    await this.init();

    const transaction = this.db.transaction([STORES.CACHE], "readwrite");
    const store = transaction.objectStore(STORES.CACHE);
    const index = store.index("expiry");

    const now = new Date().toISOString();
    const range = IDBKeyRange.upperBound(now);

    return new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`🧹 Cleaned ${deletedCount} expired cache entries`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage usage info
   */
  async getStorageInfo() {
    await this.init();

    const info = {
      schedules: 0,
      staff: 0,
      cache: 0,
      pendingOperations: 0,
      settings: 0,
    };

    for (const storeName of Object.values(STORES)) {
      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);

      await new Promise((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => {
          info[storeName] = request.result;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }

    return info;
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll() {
    await this.init();

    for (const storeName of Object.values(STORES)) {
      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }

    console.log("🗑️ All IndexedDB data cleared");
  }
}

// Create singleton instance
export const indexedDBManager = new IndexedDBManager();

// Auto-initialize in browser environment
if (typeof window !== "undefined") {
  indexedDBManager.init().catch(console.error);

  // Clean expired cache on startup
  setTimeout(() => {
    indexedDBManager.cleanExpiredCache().catch(console.error);
  }, 5000);

  // Development helper
  if (process.env.NODE_ENV === "development") {
    window.indexedDBManager = indexedDBManager;
    console.log("🔧 IndexedDB manager available: window.indexedDBManager");
  }
}

export default indexedDBManager;
