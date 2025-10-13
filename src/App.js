import React, { useState } from "react";
import ShiftScheduleEditorPhase3 from "./components/ShiftScheduleEditorPhase3.jsx";
// ForceDataLoader removed - obsolete with Phase 4 prefetch architecture
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
import PeriodMigration from "./components/migration/PeriodMigration.jsx";
import { useSupabase } from "./hooks/useSupabase.js";
import { RestaurantProvider } from "./contexts/RestaurantContext";
import { SettingsProvider } from "./contexts/SettingsContext";

function AppContent() {
  const {
    isConnected,
    error,
    scheduleData,
    saveScheduleData,
    loadScheduleData,
  } = useSupabase();

  const [migrationComplete, setMigrationComplete] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Phase 4: Use prefetch architecture directly - no forced data needed
  const effectiveScheduleData = scheduleData;

  return (
    <>
      {/* Period Migration - handles localStorage to database migration */}
      <PeriodMigration onMigrationComplete={() => setMigrationComplete(true)} />

      <DashboardLayout onShowSettings={() => setShowSettingsModal(true)}>
        {/* PHASE 4 PREFETCH ARCHITECTURE - Production Implementation */}
        <ShiftScheduleEditorPhase3
          supabaseScheduleData={effectiveScheduleData}
          isConnected={isConnected}
          error={error}
          onSaveSchedule={saveScheduleData}
          loadScheduleData={loadScheduleData}
          showSettingsModal={showSettingsModal}
          setShowSettingsModal={setShowSettingsModal}
        />
      </DashboardLayout>
    </>
  );
}

function App() {
  return (
    <RestaurantProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </RestaurantProvider>
  );
}

export default App;
