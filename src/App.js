import React, { useState } from "react";
import ShiftScheduleEditorRealtime from "./components/ShiftScheduleEditorRealtime.jsx";
import ForceDataLoader from "./components/ForceDataLoader.jsx";
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
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

  // Use forced data if available, otherwise use Supabase data
  const effectiveScheduleData = forceData || scheduleData;

  return (
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
