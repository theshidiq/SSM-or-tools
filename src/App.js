import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import ShiftScheduleEditorPhase3 from "./components/ShiftScheduleEditorPhase3.jsx";
// ForceDataLoader removed - obsolete with Phase 4 prefetch architecture
import DashboardLayout from "./components/layout/DashboardLayout.jsx";
import PeriodMigration from "./components/migration/PeriodMigration.jsx";
import ResearchPage from "./components/research/ResearchPage.jsx";
import { useSupabase } from "./hooks/useSupabase.js";
import { usePriorityRulesData } from "./hooks/usePriorityRulesData.js";
import { useStaffGroupsData } from "./hooks/useStaffGroupsData.js";
import { RestaurantProvider } from "./contexts/RestaurantContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { supabase } from "./utils/supabase";
import { useEffect } from "react";

function AppContent() {
  const {
    isConnected,
    error,
    scheduleData,
    saveScheduleData,
    loadScheduleData,
  } = useSupabase();

  // ✅ REAL-TIME FIX: Load settings from Supabase with real-time subscriptions
  // Uses Supabase built-in real-time instead of broken Go WebSocket
  usePriorityRulesData();
  useStaffGroupsData();

  // 🌉 SIMPLE BRIDGE: Populate localStorage for ML training on mount
  // FIXED: Use correct localStorage keys that match optimizedStorage expectations
  useEffect(() => {
    const populateLocalStorage = async () => {
      try {
        console.log('🔄 [Simple Bridge] Populating localStorage for ML training...');

        // Fetch schedules and staff assignments
        const { data: schedules } = await supabase
          .from('schedules')
          .select('id, schedule_data');

        const { data: assignments } = await supabase
          .from('schedule_staff_assignments')
          .select('schedule_id, staff_id, period_index');

        // Fetch staff data for all periods
        const { data: staff } = await supabase
          .from('staff')
          .select('*');

        if (!schedules || !assignments || !staff) {
          console.warn('⚠️ [Simple Bridge] No data to sync');
          return;
        }

        // Build a map of schedule_id => schedule for faster lookup
        const scheduleMap = {};
        schedules.forEach(schedule => {
          scheduleMap[schedule.id] = schedule;
        });

        // Group schedule data by period
        const periodScheduleMap = {};
        // Group staff data by period (track which staff are active in each period)
        const periodStaffMap = {};

        assignments.forEach(assignment => {
          const schedule = scheduleMap[assignment.schedule_id];
          if (!schedule || !schedule.schedule_data) return;

          const periodIndex = assignment.period_index;

          // Initialize period maps if needed
          if (!periodScheduleMap[periodIndex]) {
            periodScheduleMap[periodIndex] = {};
          }
          if (!periodStaffMap[periodIndex]) {
            periodStaffMap[periodIndex] = new Set();
          }

          // Track staff IDs active in this period
          periodStaffMap[periodIndex].add(assignment.staff_id);

          // Parse schedule_data
          let scheduleData = schedule.schedule_data;
          if (typeof scheduleData === 'string') {
            try {
              scheduleData = JSON.parse(scheduleData);
            } catch (e) {
              console.warn(`⚠️ Failed to parse schedule_data for schedule ${schedule.id}:`, e);
              return;
            }
          }

          // Merge all staff from this schedule into the period
          if (scheduleData && typeof scheduleData === 'object') {
            Object.assign(periodScheduleMap[periodIndex], scheduleData);
          }
        });

        // Save schedule and staff data to localStorage with CORRECT keys
        Object.keys(periodScheduleMap).forEach(periodIndex => {
          // FIXED: Use "schedule-X" instead of "scheduleData_X"
          const scheduleKey = `schedule-${periodIndex}`;
          localStorage.setItem(scheduleKey, JSON.stringify(periodScheduleMap[periodIndex]));

          // FIXED: Add staff data sync with "staff-X" key
          const periodStaffIds = Array.from(periodStaffMap[periodIndex] || []);
          const periodStaff = staff.filter(s => periodStaffIds.includes(s.id));
          const staffKey = `staff-${periodIndex}`;
          localStorage.setItem(staffKey, JSON.stringify(periodStaff));

          console.log(`✅ [Simple Bridge] Period ${periodIndex}: ${Object.keys(periodScheduleMap[periodIndex]).length} staff schedules, ${periodStaff.length} staff members`);
        });

        console.log(`🎉 [Simple Bridge] Populated ${Object.keys(periodScheduleMap).length} periods to localStorage`);
      } catch (error) {
        console.error('❌ [Simple Bridge] Failed to populate localStorage:', error);
      }
    };

    populateLocalStorage();
  }, []);

  const [migrationComplete, setMigrationComplete] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // State to receive connection props from ShiftScheduleEditorPhase3
  const [connectionProps, setConnectionProps] = useState({
    isConnected: false,
    isSaving: false,
    prefetchStats: null,
  });

  // Phase 4: Use prefetch architecture directly - no forced data needed
  const effectiveScheduleData = scheduleData;

  return (
    <>
      {/* Period Migration - handles localStorage to database migration */}
      <PeriodMigration onMigrationComplete={() => setMigrationComplete(true)} />

      <DashboardLayout
        onShowSettings={() => setShowSettingsModal(true)}
        isConnected={connectionProps.isConnected}
        isSaving={connectionProps.isSaving}
        prefetchStats={connectionProps.prefetchStats}
      >
        {/* PHASE 4 PREFETCH ARCHITECTURE - Production Implementation */}
        <ShiftScheduleEditorPhase3
          supabaseScheduleData={effectiveScheduleData}
          isConnected={isConnected}
          error={error}
          onSaveSchedule={saveScheduleData}
          loadScheduleData={loadScheduleData}
          showSettingsModal={showSettingsModal}
          setShowSettingsModal={setShowSettingsModal}
          onConnectionPropsChange={setConnectionProps}
        />
      </DashboardLayout>
    </>
  );
}

function App() {
  return (
    <Router>
      <RestaurantProvider>
        <SettingsProvider>
          <Routes>
            <Route path="/" element={<AppContent />} />
            <Route path="/research" element={<ResearchPage />} />
          </Routes>
        </SettingsProvider>
      </RestaurantProvider>
    </Router>
  );
}

export default App;
