import React, { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";
import { refreshPeriodsCache } from "../../utils/dateUtils";

// Migration component to handle localStorage to database migration
export const PeriodMigration = ({ onMigrationComplete }) => {
  const [migrationStatus, setMigrationStatus] = useState("checking");
  const [error, setError] = useState(null);

  const defaultMonthPeriods = [
    {
      start: new Date(Date.UTC(2025, 0, 21)),
      end: new Date(Date.UTC(2025, 1, 20)),
      label: "1月・2月",
    },
    {
      start: new Date(Date.UTC(2025, 1, 21)),
      end: new Date(Date.UTC(2025, 2, 20)),
      label: "2月・3月",
    },
    {
      start: new Date(Date.UTC(2025, 2, 21)),
      end: new Date(Date.UTC(2025, 3, 20)),
      label: "3月・4月",
    },
    {
      start: new Date(Date.UTC(2025, 3, 21)),
      end: new Date(Date.UTC(2025, 4, 20)),
      label: "4月・5月",
    },
    {
      start: new Date(Date.UTC(2025, 4, 21)),
      end: new Date(Date.UTC(2025, 5, 20)),
      label: "5月・6月",
    },
    {
      start: new Date(Date.UTC(2025, 5, 21)),
      end: new Date(Date.UTC(2025, 6, 20)),
      label: "6月・7月",
    },
  ];

  useEffect(() => {
    const performMigration = async () => {
      try {
        setMigrationStatus("checking");

        // Check if migration has already been completed
        const migrationKey = "periods_migrated_to_supabase";
        const alreadyMigrated = localStorage.getItem(migrationKey);

        if (alreadyMigrated) {
          console.log("✅ Periods migration already completed");
          setMigrationStatus("completed");
          if (onMigrationComplete) onMigrationComplete();
          return;
        }

        // Check if we have periods in database
        const { data: existingPeriods, error: fetchError } =
          await supabase.rpc("get_periods");

        if (fetchError) {
          console.error("❌ Failed to check existing periods:", fetchError);
          setError(fetchError.message);
          setMigrationStatus("error");
          return;
        }

        if (existingPeriods && existingPeriods.length > 0) {
          console.log(
            "✅ Periods already exist in database, skipping migration",
          );
          localStorage.setItem(migrationKey, "true");
          setMigrationStatus("completed");
          if (onMigrationComplete) onMigrationComplete();
          return;
        }

        setMigrationStatus("migrating");

        // Check for localStorage periods to migrate
        const periodsStorageKey = "shift_manager_periods";
        const stored = localStorage.getItem(periodsStorageKey);

        if (stored) {
          console.log("🔄 Migrating periods from localStorage to database...");

          try {
            const serializedPeriods = JSON.parse(stored);

            // Insert periods into Supabase
            for (const period of serializedPeriods) {
              const { error: insertError } = await supabase.rpc("add_period", {
                p_start_date: period.start.split("T")[0],
                p_end_date: period.end.split("T")[0],
                p_label: period.label,
              });

              if (insertError) {
                console.error(
                  "Failed to migrate period:",
                  period.label,
                  insertError,
                );
                // Continue with other periods even if one fails
              }
            }

            console.log("✅ Successfully migrated periods from localStorage");
          } catch (parseError) {
            console.error(
              "❌ Failed to parse localStorage periods:",
              parseError,
            );
            // Fall through to create default periods
          }
        } else {
          // Check if this is first time use
          const hasEverHadPeriods = localStorage.getItem(
            "periods_ever_initialized",
          );

          if (!hasEverHadPeriods) {
            console.log(
              "🆕 First time use - creating default periods in database...",
            );

            // Create default periods
            for (const period of defaultMonthPeriods) {
              const { error: insertError } = await supabase.rpc("add_period", {
                p_start_date: period.start.toISOString().split("T")[0],
                p_end_date: period.end.toISOString().split("T")[0],
                p_label: period.label,
              });

              if (insertError) {
                console.error(
                  "Failed to create default period:",
                  period.label,
                  insertError,
                );
                // Continue with other periods even if one fails
              }
            }

            console.log("✅ Successfully created default periods");
          } else {
            console.log(
              "ℹ️ User previously deleted all periods - respecting choice",
            );
          }
        }

        // Mark migration as completed
        localStorage.setItem(migrationKey, "true");

        // Refresh the periods cache
        await refreshPeriodsCache();

        setMigrationStatus("completed");
        console.log("✅ Period migration completed successfully");

        if (onMigrationComplete) onMigrationComplete();
      } catch (err) {
        console.error("❌ Migration failed:", err);
        setError(err.message);
        setMigrationStatus("error");

        // Still call completion callback so app doesn't hang
        if (onMigrationComplete) onMigrationComplete();
      }
    };

    performMigration();
  }, [onMigrationComplete]);

  // Don't render anything - this is a background migration
  if (migrationStatus === "completed" || migrationStatus === "error") {
    return null;
  }

  // Show loading indicator during migration
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card p-6 rounded-lg shadow-lg max-w-md text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <h3 className="text-lg font-semibold mb-2">
          {migrationStatus === "checking" && "Checking periods..."}
          {migrationStatus === "migrating" && "Migrating periods..."}
        </h3>
        <p className="text-sm text-muted-foreground">
          {migrationStatus === "checking" && "Verifying database state..."}
          {migrationStatus === "migrating" && "Moving periods to database..."}
        </p>
      </div>
    </div>
  );
};

export default PeriodMigration;
