import React, { useState } from "react";
import ShiftScheduleEditorRealtime from "./components/ShiftScheduleEditorRealtime.jsx";
import ForceDataLoader from "./components/ForceDataLoader.jsx";
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
import PeriodMigration from "./components/migration/PeriodMigration.jsx";
import { useSupabase } from "./hooks/useSupabase.js";
import { RestaurantProvider } from "./contexts/RestaurantContext";

function AppContent() {
  const {
    isConnected,
    error,
    scheduleData,
    saveScheduleData,
    loadScheduleData,
  } = useSupabase();

  const [forceData, setForceData] = useState(null);
  const [migrationComplete, setMigrationComplete] = useState(false);

  // Use forced data if available, otherwise use Supabase data
  const effectiveScheduleData = forceData || scheduleData;

  return (
    <>
      {/* Period Migration - handles localStorage to database migration */}
      <PeriodMigration onMigrationComplete={() => setMigrationComplete(true)} />

      <DashboardLayout>
        {/* Phase 1: Force load actual Supabase data for migration testing */}
        <ForceDataLoader onDataLoaded={setForceData} />

        {/* NEW REAL-TIME VERSION - Phase 1 Implementation */}
        <ShiftScheduleEditorRealtime
          supabaseScheduleData={effectiveScheduleData}
          isConnected={isConnected}
          error={error}
          onSaveSchedule={saveScheduleData}
          loadScheduleData={loadScheduleData}
        />
      </DashboardLayout>
    </>
  );
}

function App() {
  return (
    <RestaurantProvider>
      <AppContent />
    </RestaurantProvider>
  );
}

export default App;
