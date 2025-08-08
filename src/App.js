import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ShiftScheduleEditor from "./components/ShiftScheduleEditor.jsx";
import { useSupabase } from "./hooks/useSupabase.js";
import { RestaurantProvider } from "./contexts/RestaurantContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false,
      retry: 3,
    },
    mutations: {
      retry: 3,
    },
  },
});

function AppContent() {
  const {
    isConnected,
    error,
    scheduleData,
    saveScheduleData,
    loadScheduleData,
    checkConnection,
  } = useSupabase();

  // Load initial data
  useEffect(() => {
    const initializeData = async () => {
      try {
        await checkConnection();
        await loadScheduleData(); // Load latest schedule
      } catch (err) {
        console.error("Failed to initialize data:", err);
      }
    };

    initializeData();
  }, [checkConnection, loadScheduleData]);

  return (
    <div className="App">
      <ShiftScheduleEditor
        supabaseScheduleData={scheduleData}
        isConnected={isConnected}
        error={error}
        onSaveSchedule={saveScheduleData}
        loadScheduleData={loadScheduleData}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RestaurantProvider>
        <AppContent />
      </RestaurantProvider>
    </QueryClientProvider>
  );
}

export default App;
