import React, { useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

const DashboardLayout = React.memo(({
  children,
  onShowSettings,
  // Connection status props for sidebar
  isConnected,
  isSaving,
  prefetchStats,
}) => {
  const location = useLocation();

  // Determine currentView based on route - memoized to prevent re-computation
  const currentView = useMemo(() => {
    if (location.pathname === "/calendar") return "calendar";
    if (location.pathname === "/research") return "research";
    if (location.pathname === "/") return "schedule";
    return "schedule";
  }, [location.pathname]);

  const handleViewChange = useCallback((view) => {
    // Navigation is handled by Sidebar using navigate()
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        onShowSettings={onShowSettings}
        isConnected={isConnected}
        isSaving={isSaving}
        prefetchStats={prefetchStats}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">{children}</div>
        </main>
      </div>
    </div>
  );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;
