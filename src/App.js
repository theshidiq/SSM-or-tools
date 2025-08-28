import React, { useState } from "react";
import ShiftScheduleEditorRealtime from "./components/ShiftScheduleEditorRealtime.jsx";
import ConsoleLogViewer from "./components/debug/ConsoleLogViewer.jsx";
import ForceDataLoader from "./components/ForceDataLoader.jsx";
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
    <div className="App">
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
      {/* Debug info */}
      {process.env.NODE_ENV === "development" && (
        <div style={{position: 'fixed', top: 10, right: 10, background: 'yellow', padding: '10px', fontSize: '12px'}}>
          Force Data: {forceData ? 'LOADED' : 'NULL'}<br/>
          Schedule Data: {scheduleData ? 'LOADED' : 'NULL'}<br/>
          Effective: {effectiveScheduleData ? 'LOADED' : 'NULL'}
        </div>
      )}
      {/* Console Log Viewer - Only in development */}
      {process.env.NODE_ENV === "development" && <ConsoleLogViewer />}
    </div>
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
