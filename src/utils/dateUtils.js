import { addDays, format } from "date-fns";
import { supabase } from "./supabase";

// Function to generate initial periods dynamically (21st to 20th of next month)
// Using UTC dates to ensure consistent ISO string representation
const generateInitialPeriods = (startYear = null, periodCount = 12) => {
  const periods = [];
  const monthNames = [
    "",
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];

  const today = new Date();
  const currentDate = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Determine starting year and month based on current date
  let currentYear = startYear || currentDate.getFullYear();
  let currentMonth;

  if (startYear) {
    // If specific start year provided, start from January
    currentMonth = 0;
  } else {
    // Start from a period that would contain today's date
    // If today is after the 20th, we're in the period that started this month
    // If today is before the 21st, we're in the period that started last month
    if (currentDate.getDate() >= 21) {
      currentMonth = currentDate.getMonth();
    } else {
      currentMonth = currentDate.getMonth() - 1;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear = currentYear - 1;
      }
    }
  }

  console.log(
    `🏗️ Generating ${periodCount} periods starting from ${currentYear}-${currentMonth + 1} (today: ${currentDate.toISOString().split("T")[0]})`,
  );

  for (let i = 0; i < periodCount; i++) {
    const startDate = new Date(Date.UTC(currentYear, currentMonth, 21));

    // Calculate next month for end date
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;

    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear = currentYear + 1;
    }

    const endDate = new Date(Date.UTC(nextYear, nextMonth, 20));

    // Generate label
    const startMonthName = monthNames[currentMonth + 1];
    const endMonthName = monthNames[nextMonth + 1];
    const label = `${startMonthName}・${endMonthName}`;

    periods.push({
      start: startDate,
      end: endDate,
      label: label,
    });

    console.log(
      `🏗️ Generated period ${i}: ${label} (${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]})`,
    );

    // Move to next month
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  return periods;
};

// Storage key for localStorage migration tracking
const PERIODS_STORAGE_KEY = "shift_manager_periods";
const MIGRATION_KEY = "periods_migrated_to_supabase";

// In-memory cache for periods
let periodsCache = [];
let cacheInitialized = false;

// Function to migrate localStorage periods to Supabase
const migratePeriodsToSupabase = async () => {
  try {
    const migrated = localStorage.getItem(MIGRATION_KEY);
    if (migrated) return; // Already migrated

    const stored = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (stored) {
      const serializedPeriods = JSON.parse(stored);

      // Insert periods into Supabase
      for (const period of serializedPeriods) {
        await supabase.rpc("add_period", {
          p_start_date: period.start.split("T")[0], // Convert to DATE format
          p_end_date: period.end.split("T")[0],
          p_label: period.label,
        });
      }

      console.log("✅ Migrated periods from localStorage to Supabase");
    } else {
      // First time setup - add default periods
      const hasEverHadPeriods = localStorage.getItem(
        "periods_ever_initialized",
      );
      if (!hasEverHadPeriods) {
        const initialPeriods = generateInitialPeriods();
        for (const period of initialPeriods) {
          await supabase.rpc("add_period", {
            p_start_date: period.start.toISOString().split("T")[0],
            p_end_date: period.end.toISOString().split("T")[0],
            p_label: period.label,
          });
        }
        console.log("✅ Initialized default periods in Supabase");
      }
    }

    // Mark as migrated
    localStorage.setItem(MIGRATION_KEY, "true");
  } catch (error) {
    console.error("Failed to migrate periods to Supabase:", error);
  }
};

// Function to load periods from Supabase
const loadPeriodsFromSupabase = async () => {
  try {
    const { data, error } = await supabase.rpc("get_periods");

    if (error) throw error;

    if (!data || data.length === 0) {
      // Try migration first
      await migratePeriodsToSupabase();

      // Try loading again
      const { data: retryData, error: retryError } =
        await supabase.rpc("get_periods");
      if (retryError) throw retryError;

      if (!retryData || retryData.length === 0) {
        console.warn("No periods found in database");
        return [];
      }

      return retryData.map((period) => ({
        id: period.id,
        start: new Date(period.start_date + "T00:00:00.000Z"),
        end: new Date(period.end_date + "T00:00:00.000Z"),
        label: period.label,
      }));
    }

    return data.map((period) => ({
      id: period.id,
      start: new Date(period.start_date + "T00:00:00.000Z"),
      end: new Date(period.end_date + "T00:00:00.000Z"),
      label: period.label,
    }));
  } catch (error) {
    console.error("Failed to load periods from Supabase:", error);

    // Fallback to localStorage for offline support
    const stored = localStorage.getItem(PERIODS_STORAGE_KEY);
    if (stored) {
      const serializedPeriods = JSON.parse(stored);
      return serializedPeriods.map((period) => ({
        start: new Date(period.start),
        end: new Date(period.end),
        label: period.label,
      }));
    }

    // Last fallback to generate initial periods dynamically
    const hasEverHadPeriods = localStorage.getItem("periods_ever_initialized");
    return hasEverHadPeriods ? [] : generateInitialPeriods();
  }
};

// Function to initialize periods cache
const initializePeriodsCache = async () => {
  if (cacheInitialized) return periodsCache;

  periodsCache = await loadPeriodsFromSupabase();
  cacheInitialized = true;

  // Note: cleanup will be available after function declaration below

  return periodsCache;
};

// Function to refresh periods cache
export const refreshPeriodsCache = async () => {
  console.log("🔄 Refreshing dateUtils periods cache from database...");
  const freshPeriods = await loadPeriodsFromSupabase();
  console.log(
    `📊 Loaded ${freshPeriods.length} periods from database:`,
    freshPeriods.map((p) => p.label),
  );
  periodsCache = freshPeriods;
  cacheInitialized = true;
  return periodsCache;
};

// Function to synchronize cache with external periods data
export const synchronizePeriodsCache = (externalPeriods) => {
  if (Array.isArray(externalPeriods)) {
    // Prevent redundant synchronizations by checking if data has actually changed
    const hasChanged =
      !cacheInitialized ||
      periodsCache.length !== externalPeriods.length ||
      periodsCache.some(
        (cached, idx) =>
          !externalPeriods[idx] ||
          cached.label !== externalPeriods[idx].label ||
          cached.start?.toISOString() !==
            new Date(externalPeriods[idx].start).toISOString(),
      );

    if (hasChanged) {
      periodsCache = [...externalPeriods]; // Create a copy to avoid reference issues
      cacheInitialized = true;
      // Only log on significant changes (development mode)
      if (process.env.NODE_ENV === "development") {
        console.log(
          `🔄 Synchronized dateUtils cache with ${externalPeriods.length} periods`,
        );
      }
    }
    // Remove verbose "skipping" logs to reduce console noise
    return periodsCache;
  }
  return periodsCache;
};

// Function to clean up duplicate periods
export const cleanupDuplicatePeriods = async () => {
  try {
    await initializePeriodsCache();

    // Find duplicates by date range
    const seen = new Map();
    const duplicates = [];

    periodsCache.forEach((period) => {
      const startDate = new Date(period.start).toISOString().split("T")[0];
      const endDate = new Date(period.end).toISOString().split("T")[0];
      const dateKey = `${startDate}-${endDate}`;

      if (seen.has(dateKey)) {
        // This is a duplicate - mark for deletion
        duplicates.push(period);
      } else {
        seen.set(dateKey, period);
      }
    });

    if (duplicates.length === 0) {
      console.log("✅ No duplicate periods found");
      return { removed: 0, remaining: periodsCache.length };
    }

    console.log(`🔄 Found ${duplicates.length} duplicate periods, removing...`);

    // Remove duplicates from database
    let removedCount = 0;
    for (const duplicate of duplicates) {
      if (duplicate.id) {
        try {
          const { error } = await supabase.rpc("delete_period", {
            period_id: duplicate.id,
          });

          if (error) throw error;
          removedCount++;
          console.log(`✅ Removed duplicate period: ${duplicate.label}`);
        } catch (error) {
          console.error(
            `Failed to remove duplicate period ${duplicate.label}:`,
            error,
          );
        }
      }
    }

    // Refresh cache after cleanup
    await refreshPeriodsCache();

    const result = { removed: removedCount, remaining: periodsCache.length };
    console.log(
      `✅ Cleanup complete: removed ${removedCount} duplicates, ${periodsCache.length} periods remaining`,
    );
    return result;
  } catch (error) {
    console.error("Failed to cleanup duplicate periods:", error);
    return { removed: 0, remaining: periodsCache.length, error: error.message };
  }
};

// Function to get periods (for compatibility)
export const getMonthPeriods = () => {
  return cacheInitialized ? periodsCache : [];
};

// Export reactive periods array that updates from cache
export const monthPeriods = new Proxy([], {
  get(target, prop) {
    if (prop === "length") {
      return cacheInitialized ? periodsCache.length : 0;
    }
    if (
      prop === "map" ||
      prop === "forEach" ||
      prop === "filter" ||
      prop === "find" ||
      prop === "findIndex"
    ) {
      return cacheInitialized
        ? periodsCache[prop].bind(periodsCache)
        : [][prop].bind([]);
    }
    if (typeof prop === "string" && !isNaN(prop)) {
      const index = parseInt(prop);
      return cacheInitialized ? periodsCache[index] : undefined;
    }
    if (!cacheInitialized) {
      return undefined;
    }
    return periodsCache[prop];
  },
  set(target, prop, value) {
    if (cacheInitialized) {
      periodsCache[prop] = value;
    }
    return true;
  },
  has(target, prop) {
    return cacheInitialized ? prop in periodsCache : false;
  },
  ownKeys(target) {
    return cacheInitialized ? Object.keys(periodsCache) : [];
  },
  getOwnPropertyDescriptor(target, prop) {
    return cacheInitialized
      ? Object.getOwnPropertyDescriptor(periodsCache, prop)
      : undefined;
  },
});

// Initialize cache on module load
initializePeriodsCache();

// Expose cleanup function to window for manual use (development only)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.cleanupDuplicatePeriods = cleanupDuplicatePeriods;
}

// Function to add next period
export const addNextPeriod = async () => {
  await initializePeriodsCache(); // Ensure cache is initialized

  const lastPeriod = periodsCache[periodsCache.length - 1];
  if (!lastPeriod || !lastPeriod.end) {
    console.error("Cannot add next period - no valid last period found");
    return 0;
  }

  const lastEndDate = new Date(lastPeriod.end);

  // Next period starts the day after the last period ends
  const nextStartDate = new Date(lastEndDate);
  nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
  nextStartDate.setUTCHours(0, 0, 0, 0); // Ensure midnight UTC

  // Next period ends after one month
  const nextEndDate = new Date(nextStartDate);
  nextEndDate.setUTCMonth(nextEndDate.getUTCMonth() + 1);
  nextEndDate.setUTCDate(nextEndDate.getUTCDate() - 1);
  nextEndDate.setUTCHours(0, 0, 0, 0); // Ensure midnight UTC

  // Check for duplicate periods before creating
  const nextStartDateString = nextStartDate.toISOString().split("T")[0];
  const nextEndDateString = nextEndDate.toISOString().split("T")[0];

  const existingPeriod = periodsCache.find((period) => {
    const existingStart = new Date(period.start).toISOString().split("T")[0];
    const existingEnd = new Date(period.end).toISOString().split("T")[0];
    return (
      existingStart === nextStartDateString && existingEnd === nextEndDateString
    );
  });

  if (existingPeriod) {
    console.warn(
      `⚠️ Period already exists: ${existingPeriod.label} (${nextStartDateString} to ${nextEndDateString})`,
    );
    // Return the index of the existing period instead of creating duplicate
    const existingIndex = periodsCache.findIndex((p) => p === existingPeriod);
    return existingIndex;
  }

  // Generate label based on months
  const startMonth = nextStartDate.getUTCMonth() + 1;
  const endMonth = nextEndDate.getUTCMonth() + 1;
  const startMonthName = [
    "",
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ][startMonth];
  const endMonthName = [
    "",
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ][endMonth];

  const label = `${startMonthName}・${endMonthName}`;

  try {
    // Add period to Supabase
    const { data, error } = await supabase.rpc("add_period", {
      p_start_date: nextStartDateString,
      p_end_date: nextEndDateString,
      p_label: label,
    });

    if (error) throw error;

    console.log(`✅ Added new period to database: ${label}`);

    // Refresh cache from database with retry logic
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      await refreshPeriodsCache();

      // Check if the new period is now in the cache
      const newPeriodExists = periodsCache.find((period) => {
        const periodStart = new Date(period.start).toISOString().split("T")[0];
        const periodEnd = new Date(period.end).toISOString().split("T")[0];
        return (
          periodStart === nextStartDateString &&
          periodEnd === nextEndDateString &&
          period.label === label
        );
      });

      if (newPeriodExists) {
        console.log(
          `✅ Period ${label} confirmed in cache after ${retryCount + 1} attempts`,
        );
        return periodsCache.length - 1; // Return the new period index
      }

      retryCount++;
      if (retryCount < maxRetries) {
        console.log(
          `⏳ Period ${label} not yet in cache, retry ${retryCount}/${maxRetries} after 200ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.warn(
      `⚠️ Period ${label} added to database but not confirmed in cache after ${maxRetries} attempts`,
    );
    return periodsCache.length - 1; // Return best guess index
  } catch (error) {
    console.error("Failed to add period to database:", error);

    // Fallback: add to cache only
    const newPeriod = {
      start: nextStartDate,
      end: nextEndDate,
      label: label,
    };

    periodsCache.push(newPeriod);
    console.log(
      `⚠️ Added new period to cache only: ${label} (database failed)`,
    );
    return periodsCache.length - 1;
  }
};

// Generate date range based on current month index
// Optionally accepts periods array to use instead of cache (for React state synchronization)
export const generateDateRange = (monthIndex, periodsFromState = null) => {
  // Use provided periods or fall back to cache
  const periodsToUse = periodsFromState || periodsCache;
  const isUsingCache = !periodsFromState;

  // Handle case where no periods exist or cache not initialized
  if (isUsingCache && (!cacheInitialized || periodsToUse.length === 0)) {
    // Only log once during development, not repeatedly
    if (
      process.env.NODE_ENV === "development" &&
      !window._dateUtilsWarningShown
    ) {
      console.log(
        "⏳ [PERIODS] Loading periods from database - date range will populate when ready",
      );
      window._dateUtilsWarningShown = true;
    }
    return [];
  }

  // Handle empty periods from state
  if (!periodsToUse || periodsToUse.length === 0) {
    return [];
  }

  // Bounds check for monthIndex
  if (
    monthIndex < 0 ||
    monthIndex >= periodsToUse.length ||
    periodsToUse[monthIndex] === undefined
  ) {
    monthIndex = 0;
    if (periodsToUse.length === 0) {
      return []; // Still empty, return empty array
    }
  }

  const period = periodsToUse[monthIndex];
  if (!period || !period.start || !period.end) {
    console.error(`Invalid period for monthIndex ${monthIndex}:`, period);
    // If we have no valid periods, return empty array
    if (periodsToUse.length === 0) {
      return [];
    }
    // Try first period as fallback
    return generateDateRange(0, periodsToUse);
  }

  const dates = [];
  let currentDate = new Date(period.start);

  const endDate = new Date(period.end);

  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate = addDays(currentDate, 1);
  }

  return dates;
};

// Helper function to get days in a month
export const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

// Helper function to check if date is within staff work period
export const isDateWithinWorkPeriod = (date, staff) => {
  if (!staff.startPeriod) return true; // If no start period defined, assume always working

  const currentDate = new Date(date);

  // Check if before start date
  const startDate = new Date(
    staff.startPeriod.year,
    staff.startPeriod.month - 1,
    staff.startPeriod.day || 1,
  );

  if (currentDate < startDate) {
    return false; // Before start date
  }

  // Check if after end date (if end period is defined)
  if (staff.endPeriod) {
    const endDate = new Date(
      staff.endPeriod.year,
      staff.endPeriod.month - 1,
      staff.endPeriod.day ||
        getDaysInMonth(staff.endPeriod.year, staff.endPeriod.month),
    );

    if (currentDate > endDate) {
      return false; // After end date
    }
  }

  return true; // Within work period
};

// Function to get the current month index based on today's date
export const getCurrentMonthIndex = async (periods = null) => {
  // Use provided periods or fall back to cache
  let periodsToUse = periods || periodsCache;

  // Handle case where no periods exist - auto-initialize from database
  if (!periodsToUse || periodsToUse.length === 0) {
    console.log("📅 No periods available, loading from database...");
    await initializePeriodsCache();
    periodsToUse = periodsCache;

    if (periodsToUse.length === 0) {
      console.log("📅 No periods in database, using default periods...");
      return 0; // Default to 0 when no periods exist
    }
  }

  const today = new Date();
  const todayUTC = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Debug: Log all periods to understand what we have
  console.log(
    `📅 Debugging getCurrentMonthIndex for ${todayUTC.toISOString().split("T")[0]}`,
  );
  console.log(`📅 Total periods available: ${periodsToUse.length}`);
  periodsToUse.forEach((period, index) => {
    const startDate = new Date(period.start);
    const endDate = new Date(period.end);
    const containsToday = todayUTC >= startDate && todayUTC <= endDate;
    console.log(
      `📅 Period ${index}: ${period.label} (${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}) - Contains today: ${containsToday}`,
    );
  });

  // Find the period that contains today's date
  for (let i = 0; i < periodsToUse.length; i++) {
    const period = periodsToUse[i];
    const periodStart = new Date(period.start);
    const periodEnd = new Date(period.end);

    if (todayUTC >= periodStart && todayUTC <= periodEnd) {
      console.log(
        `📅 Today (${todayUTC.toISOString().split("T")[0]}) falls in period ${i}: ${period.label}`,
      );
      return i;
    }
  }

  // If today's date doesn't fall in any existing period, check if it's before the first period
  if (periodsToUse.length > 0) {
    const firstPeriodStart = new Date(periodsToUse[0].start);
    if (todayUTC < firstPeriodStart) {
      console.log(
        `📅 Today is before all periods, using first period (${periodsToUse[0].label})`,
      );
      return 0;
    }
  }

  // If today's date is after all periods, automatically extend periods to cover today
  if (periodsToUse.length > 0) {
    const lastPeriod = periodsToUse[periodsToUse.length - 1];
    const lastEndDate = new Date(lastPeriod.end);

    if (todayUTC > lastEndDate) {
      console.log(
        `📅 Today (${todayUTC.toISOString().split("T")[0]}) is after all periods (last ends ${lastEndDate.toISOString().split("T")[0]}), auto-extending...`,
      );

      let extendedPeriods = 0;
      let currentLastEndDate = lastEndDate;

      // Keep adding periods until we cover today's date
      while (todayUTC > currentLastEndDate) {
        try {
          const newPeriodIndex = await addNextPeriod();
          extendedPeriods++;

          // Refresh cache to get the new period
          await refreshPeriodsCache();
          periodsToUse = periodsCache;

          if (periodsToUse.length === 0) {
            console.error("📅 Failed to extend periods - cache is empty");
            return 0;
          }

          currentLastEndDate = new Date(
            periodsToUse[periodsToUse.length - 1].end,
          );
          console.log(
            `📅 Extended to period ending ${currentLastEndDate.toISOString().split("T")[0]}`,
          );

          // Safety check to prevent infinite loop
          if (extendedPeriods > 12) {
            console.warn(
              "📅 Extended more than 12 periods, stopping to prevent infinite loop",
            );
            break;
          }
        } catch (error) {
          console.error("📅 Failed to extend periods:", error);
          break;
        }
      }

      if (extendedPeriods > 0) {
        console.log(
          `📅 Auto-extended ${extendedPeriods} periods to cover current date`,
        );

        // Now find the period that contains today's date
        for (let i = 0; i < periodsToUse.length; i++) {
          const period = periodsToUse[i];
          const periodStart = new Date(period.start);
          const periodEnd = new Date(period.end);

          if (todayUTC >= periodStart && todayUTC <= periodEnd) {
            console.log(
              `📅 Today (${todayUTC.toISOString().split("T")[0]}) now falls in period ${i}: ${period.label}`,
            );
            return i;
          }
        }
      }
    }
  }

  // Gap detection: Check if today falls between existing periods (gap filling)
  if (periodsToUse.length > 1) {
    for (let i = 0; i < periodsToUse.length - 1; i++) {
      const currentPeriod = periodsToUse[i];
      const nextPeriod = periodsToUse[i + 1];
      const currentEnd = new Date(currentPeriod.end);
      const nextStart = new Date(nextPeriod.start);

      // Check if today falls in a gap between periods
      if (todayUTC > currentEnd && todayUTC < nextStart) {
        console.log(
          `📅 Today falls in gap between period ${i} (${currentPeriod.label}, ends ${currentEnd.toISOString().split("T")[0]}) ` +
            `and period ${i + 1} (${nextPeriod.label}, starts ${nextStart.toISOString().split("T")[0]})`,
        );

        // Calculate the missing period dates
        const missingStart = new Date(currentEnd);
        missingStart.setUTCDate(missingStart.getUTCDate() + 1); // Day after current period ends

        const missingEnd = new Date(nextStart);
        missingEnd.setUTCDate(missingEnd.getUTCDate() - 1); // Day before next period starts

        // Generate missing period label
        const startMonth = missingStart.getUTCMonth() + 1;
        const endMonth = missingEnd.getUTCMonth() + 1;
        const monthNames = [
          "",
          "1月",
          "2月",
          "3月",
          "4月",
          "5月",
          "6月",
          "7月",
          "8月",
          "9月",
          "10月",
          "11月",
          "12月",
        ];
        const missingLabel = `${monthNames[startMonth]}・${monthNames[endMonth]}`;

        console.log(
          `📅 Adding missing period: ${missingLabel} (${missingStart.toISOString().split("T")[0]} to ${missingEnd.toISOString().split("T")[0]})`,
        );

        try {
          // Add the missing period to fill the gap
          const { data, error } = await supabase.rpc("add_period", {
            p_start_date: missingStart.toISOString().split("T")[0],
            p_end_date: missingEnd.toISOString().split("T")[0],
            p_label: missingLabel,
          });

          if (error) {
            console.error("📅 Failed to add missing period:", error);
          } else {
            console.log("📅 Successfully added missing period:", data);

            // Refresh cache to include the new period
            await refreshPeriodsCache();
            periodsToUse = periodsCache;

            // Now find the period that contains today's date
            for (let j = 0; j < periodsToUse.length; j++) {
              const period = periodsToUse[j];
              const periodStart = new Date(period.start);
              const periodEnd = new Date(period.end);

              if (todayUTC >= periodStart && todayUTC <= periodEnd) {
                console.log(
                  `📅 Today (${todayUTC.toISOString().split("T")[0]}) now falls in filled gap period ${j}: ${period.label}`,
                );
                return j;
              }
            }
          }
        } catch (addError) {
          console.error("📅 Error adding missing period:", addError);
        }

        break; // Only try to fill one gap at a time
      }
    }
  }

  // Last resort: Try to find the closest period to today's date
  if (periodsToUse.length > 0) {
    let closestPeriod = 0;
    let smallestDiff = Math.abs(todayUTC - new Date(periodsToUse[0].start));

    for (let i = 1; i < periodsToUse.length; i++) {
      const period = periodsToUse[i];
      const periodStart = new Date(period.start);
      const periodEnd = new Date(period.end);

      // Calculate distance to this period (0 if today is within the period)
      let diff;
      if (todayUTC >= periodStart && todayUTC <= periodEnd) {
        diff = 0; // Today is within this period
      } else if (todayUTC < periodStart) {
        diff = periodStart - todayUTC; // Today is before this period
      } else {
        diff = todayUTC - periodEnd; // Today is after this period
      }

      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestPeriod = i;
      }
    }

    if (smallestDiff === 0) {
      console.log(
        `📅 Found exact match: Today falls in period ${closestPeriod}: ${periodsToUse[closestPeriod].label}`,
      );
      return closestPeriod;
    } else {
      console.log(
        `📅 Using closest period ${closestPeriod}: ${periodsToUse[closestPeriod].label} (distance: ${smallestDiff}ms)`,
      );
      return closestPeriod;
    }
  }

  // Final fallback: return last available period
  console.log(
    `📅 Fallback: using last available period (${periodsToUse[periodsToUse.length - 1]?.label || "undefined"})`,
  );
  return Math.max(0, periodsToUse.length - 1);
};

// Function to find period with data, prioritizing Supabase data over localStorage
export const findPeriodWithData = async (supabaseData = null) => {
  // Handle case where no periods exist or cache not initialized
  if (!cacheInitialized || periodsCache.length === 0) {
    console.warn("No periods available for finding data");
    return 0; // Return 0 for empty state
  }

  // First, check if Supabase data contains schedule data for any period
  if (supabaseData && supabaseData.schedule_data) {
    const { _staff_members, ...actualScheduleData } =
      supabaseData.schedule_data;

    // Check each period to see if Supabase data has meaningful dates in that period's range
    for (let i = 0; i < periodsCache.length; i++) {
      const dateRange = generateDateRange(i);
      const hasDataInPeriod = dateRange.some((date) => {
        const dateKey = date.toISOString().split("T")[0];
        return Object.keys(actualScheduleData).some((staffId) => {
          const staffSchedule = actualScheduleData[staffId];
          if (!staffSchedule || typeof staffSchedule !== "object") return false;

          const shiftValue = staffSchedule[dateKey];
          const hasMeaningfulData =
            shiftValue !== undefined &&
            shiftValue !== null &&
            shiftValue !== "" &&
            shiftValue.toString().trim() !== "";

          return hasMeaningfulData;
        });
      });

      if (hasDataInPeriod) {
        console.log(
          `✅ Found schedule data in period ${i}: ${periodsCache[i].label}`,
        );
        return i;
      }
    }
  }

  // Fallback to current date-based period
  const fallbackPeriod = await getCurrentMonthIndex();
  return fallbackPeriod;
};

// Function to delete a specific period
export const deletePeriod = async (periodIndex, realtimePeriods = null) => {
  try {
    await initializePeriodsCache(); // Ensure cache is initialized

    // Use real-time periods if provided (to avoid race conditions), fallback to cache
    const periodsToUse = realtimePeriods || periodsCache;

    // Validate period index against the most current period data
    if (periodIndex < 0 || periodIndex >= periodsToUse.length) {
      console.error(
        `Invalid period index: ${periodIndex}. Available: 0-${Math.max(0, periodsToUse.length - 1)}`,
      );
      return { success: false, error: "Invalid period index" };
    }

    // Ensure cache is also synchronized before proceeding
    if (periodsToUse !== periodsCache) {
      // Refresh cache to match real-time data
      await refreshPeriodsCache();

      // Double-check bounds with refreshed cache
      if (periodIndex >= periodsCache.length) {
        console.error(
          `Period index ${periodIndex} is still out of bounds after cache refresh. Available: 0-${Math.max(0, periodsCache.length - 1)}`,
        );
        return { success: false, error: "Invalid period index after refresh" };
      }
    }

    // Get period info for logging
    const periodToDelete = periodsCache[periodIndex];
    console.log(`🗑️ Deleting period ${periodIndex}: ${periodToDelete.label}`);

    try {
      // Delete period from Supabase if it has an ID
      if (periodToDelete.id) {
        const { error } = await supabase.rpc("delete_period", {
          period_id: periodToDelete.id,
        });

        if (error) throw error;
        console.log(`✅ Period deleted from database: ${periodToDelete.label}`);
      }

      // Force immediate cache refresh from database
      await refreshPeriodsCache();

      // Verify the deleted period is actually gone from the cache
      const stillExists = periodsCache.find((p) => p.id === periodToDelete.id);
      if (!stillExists) {
        console.log(
          `✅ Period successfully removed from cache after database refresh`,
        );
      } else {
        console.warn(
          `⚠️ Period still exists in cache after refresh - forcing manual removal`,
        );
        // Force remove from cache if database refresh didn't work
        const indexToRemove = periodsCache.findIndex(
          (p) => p.id === periodToDelete.id,
        );
        if (indexToRemove >= 0) {
          periodsCache.splice(indexToRemove, 1);
          console.log(
            `✅ Period forcibly removed from cache at index ${indexToRemove}`,
          );
        }
      }
    } catch (error) {
      console.error("Failed to delete period from database:", error);

      // Fallback: remove from cache only
      periodsCache.splice(periodIndex, 1);
      console.log(
        `⚠️ Period deleted from cache only: ${periodToDelete.label} (database failed)`,
      );
    }

    // Report the CURRENT cache length after refresh
    console.log(
      `✅ Period deleted successfully. Remaining periods: ${periodsCache.length}`,
    );
    console.log(
      `📊 Current periods in cache:`,
      periodsCache.map((p) => p.label),
    );

    // Return success with navigation info
    let suggestedIndex = periodIndex;
    if (periodsCache.length === 0) {
      // No periods left - this is allowed now
      suggestedIndex = 0;
    } else if (suggestedIndex >= periodsCache.length) {
      suggestedIndex = periodsCache.length - 1; // Go to last period if deleted period was at end
    }

    // Ensure suggested index is within bounds and validate against current cache state
    suggestedIndex = Math.max(
      0,
      Math.min(suggestedIndex, periodsCache.length - 1),
    );

    // Final validation: ensure suggestedIndex doesn't exceed available periods
    const finalSuggestedIndex = periodsCache.length === 0 ? 0 : suggestedIndex;

    console.log(
      `🔄 Navigation suggestion: index ${finalSuggestedIndex} of ${periodsCache.length} remaining periods`,
    );

    return {
      success: true,
      deletedPeriod: periodToDelete,
      newPeriodCount: periodsCache.length,
      suggestedNavigationIndex: finalSuggestedIndex,
      isEmpty: periodsCache.length === 0,
    };
  } catch (error) {
    console.error("Failed to delete period:", error);
    return { success: false, error: error.message };
  }
};

// Function to reset periods to defaults (useful for testing or admin functions)
export const resetPeriodsToDefault = async () => {
  try {
    await initializePeriodsCache(); // Ensure cache is initialized

    // Clear existing periods from database
    for (const period of periodsCache) {
      if (period.id) {
        await supabase.rpc("delete_period", {
          period_id: period.id,
        });
      }
    }

    // Add default periods to database
    const initialPeriods = generateInitialPeriods();
    for (const period of initialPeriods) {
      await supabase.rpc("add_period", {
        p_start_date: period.start.toISOString().split("T")[0],
        p_end_date: period.end.toISOString().split("T")[0],
        p_label: period.label,
      });
    }

    // Refresh cache from database
    await refreshPeriodsCache();

    console.log("✅ Periods reset to default in database");
    return true;
  } catch (error) {
    console.error("Failed to reset periods:", error);

    // Fallback: reset cache only
    periodsCache.length = 0; // Clear existing array
    const initialPeriods = generateInitialPeriods();
    periodsCache.push(...initialPeriods.map((p) => ({ ...p }))); // Add default periods
    console.log("⚠️ Periods reset to default in cache only (database failed)");
    return false;
  }
};

// Dynamic dropdown positioning logic
export const getDropdownPosition = (
  staffIndex,
  dateIndex,
  totalStaff,
  totalDates,
) => {
  // Improved positioning to align better with cell dimensions
  // Cell dimensions: width: 40px, height: 50px
  const isRightSide = staffIndex >= totalStaff - 3; // Last 3 columns
  const isBottomHalf = dateIndex >= totalDates - 5; // Last 5 rows

  if (isRightSide && isBottomHalf) {
    // Above and to the left - align dropdown right edge with cell right edge
    return { right: "0px", bottom: "100%", transform: "translateY(-4px)" };
  } else if (isRightSide) {
    // Below and to the left - align dropdown right edge with cell right edge
    return { right: "0px", top: "100%", transform: "translateY(4px)" };
  } else if (isBottomHalf) {
    // Above and to the right - align dropdown left edge with cell left edge
    return { left: "0px", bottom: "100%", transform: "translateY(-4px)" };
  } else {
    // Below and to the right - align dropdown left edge with cell left edge (default)
    return { left: "0px", top: "100%", transform: "translateY(4px)" };
  }
};

// Get date label for staff work period boundaries or just formatted date
export const getDateLabel = (date, staff = null) => {
  if (!date) return "";

  const currentDate = new Date(date);

  // If no staff provided, just return formatted date
  if (!staff || !staff.startPeriod) {
    return format(currentDate, "d");
  }

  // Check if it's the start date
  const startDate = new Date(
    staff.startPeriod.year,
    staff.startPeriod.month - 1,
    staff.startPeriod.day || 1,
  );

  if (currentDate.getTime() === startDate.getTime()) {
    return "START";
  }

  // Check if it's the end date (if end period is defined)
  if (staff.endPeriod) {
    const endDate = new Date(
      staff.endPeriod.year,
      staff.endPeriod.month - 1,
      staff.endPeriod.day ||
        getDaysInMonth(staff.endPeriod.year, staff.endPeriod.month),
    );

    if (currentDate.getTime() === endDate.getTime()) {
      return "END";
    }
  }

  // If no special boundary date, return formatted date
  return format(currentDate, "d");
};

/**
 * Remap schedule data from old period dates to new period dates.
 * This allows displaying schedule data that was created with a different period configuration.
 *
 * The remapping is based on the DAY POSITION within the period, not the absolute date.
 * For example:
 * - Old period: Dec 21 - Jan 20 (day 1 = Dec 21, day 11 = Dec 31)
 * - New period: Dec 1 - Dec 31 (day 1 = Dec 1, day 11 = Dec 11)
 * - Data from Dec 21 (day 1 of old) → displays at Dec 1 (day 1 of new)
 *
 * @param {Object} scheduleData - The schedule data { staffId: { dateKey: shiftValue } }
 * @param {Object} currentPeriod - Current period { start: Date, end: Date }
 * @returns {Object} - Remapped schedule data with new date keys
 */
export const remapScheduleDataToPeriod = (scheduleData, currentPeriod) => {
  if (!scheduleData || !currentPeriod || !currentPeriod.start || !currentPeriod.end) {
    return scheduleData || {};
  }

  // Get all dates from the schedule data to detect the original period range
  const allDates = new Set();
  Object.values(scheduleData).forEach(staffSchedule => {
    if (staffSchedule && typeof staffSchedule === 'object') {
      Object.keys(staffSchedule).forEach(dateKey => allDates.add(dateKey));
    }
  });

  if (allDates.size === 0) {
    return scheduleData;
  }

  // Sort dates to find the original period range
  const sortedDates = Array.from(allDates).sort();
  const oldStartDateStr = sortedDates[0];
  const oldEndDateStr = sortedDates[sortedDates.length - 1];

  const oldStartDate = new Date(oldStartDateStr + 'T00:00:00.000Z');
  const newStartDate = new Date(currentPeriod.start);

  // Check if remapping is needed (old start differs from new start)
  const newStartStr = newStartDate.toISOString().split('T')[0];
  if (oldStartDateStr === newStartStr) {
    // No remapping needed - dates already match current period
    return scheduleData;
  }

  console.log(`🔄 [DATE-REMAP] Remapping schedule data from ${oldStartDateStr} to ${newStartStr}`);

  // Calculate the day offset between old and new period starts
  const remappedData = {};

  Object.entries(scheduleData).forEach(([staffId, staffSchedule]) => {
    if (!staffSchedule || typeof staffSchedule !== 'object') {
      remappedData[staffId] = staffSchedule;
      return;
    }

    remappedData[staffId] = {};

    Object.entries(staffSchedule).forEach(([oldDateKey, shiftValue]) => {
      // Calculate day position in old period (0-indexed)
      const oldDate = new Date(oldDateKey + 'T00:00:00.000Z');
      const dayOffset = Math.round((oldDate - oldStartDate) / (1000 * 60 * 60 * 24));

      // Calculate new date based on day position
      const newDate = new Date(newStartDate);
      newDate.setUTCDate(newDate.getUTCDate() + dayOffset);

      // Only include if within current period range
      const currentEndDate = new Date(currentPeriod.end);
      if (newDate <= currentEndDate) {
        const newDateKey = newDate.toISOString().split('T')[0];
        remappedData[staffId][newDateKey] = shiftValue;
      }
    });
  });

  console.log(`✅ [DATE-REMAP] Remapped ${allDates.size} dates for ${Object.keys(remappedData).length} staff members`);

  return remappedData;
};

/**
 * Reverse remap: Convert new period dates back to original storage dates.
 * Used when saving data to maintain consistency with stored data format.
 *
 * @param {string} newDateKey - Date in new period format (e.g., "2025-12-01")
 * @param {Object} currentPeriod - Current period { start: Date, end: Date }
 * @param {string} originalStartDateStr - The original period start date string
 * @returns {string} - Original date key for storage
 */
export const reverseRemapDateKey = (newDateKey, currentPeriod, originalStartDateStr) => {
  if (!currentPeriod || !currentPeriod.start || !originalStartDateStr) {
    return newDateKey;
  }

  const newStartDate = new Date(currentPeriod.start);
  const newStartStr = newStartDate.toISOString().split('T')[0];

  // If no remapping was done, return as-is
  if (originalStartDateStr === newStartStr) {
    return newDateKey;
  }

  const oldStartDate = new Date(originalStartDateStr + 'T00:00:00.000Z');
  const newDate = new Date(newDateKey + 'T00:00:00.000Z');

  // Calculate day offset from new period start
  const dayOffset = Math.round((newDate - newStartDate) / (1000 * 60 * 60 * 24));

  // Calculate original date
  const originalDate = new Date(oldStartDate);
  originalDate.setUTCDate(originalDate.getUTCDate() + dayOffset);

  return originalDate.toISOString().split('T')[0];
};

/**
 * Detect the original period start date from schedule data.
 * Returns the earliest date found in the schedule.
 *
 * @param {Object} scheduleData - The schedule data { staffId: { dateKey: shiftValue } }
 * @returns {string|null} - Original start date string or null if no data
 */
export const detectOriginalPeriodStart = (scheduleData) => {
  if (!scheduleData) return null;

  let earliestDate = null;

  Object.values(scheduleData).forEach(staffSchedule => {
    if (staffSchedule && typeof staffSchedule === 'object') {
      Object.keys(staffSchedule).forEach(dateKey => {
        if (!earliestDate || dateKey < earliestDate) {
          earliestDate = dateKey;
        }
      });
    }
  });

  return earliestDate;
};
