import React, { useState } from 'react';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children }) => {
  const [currentView, setCurrentView] = useState('schedule');

  const handleViewChange = (view) => {
    setCurrentView(view);
    console.log(`Navigating to: ${view}`);
    // Here you can implement actual view routing logic
  };

  const renderContent = () => {
    if (currentView === 'schedule') {
      return children;
    }
    
    // Show "Coming Soon" for all other views
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-muted-foreground mb-4">Coming Soon</h1>
          <p className="text-lg text-muted-foreground capitalize">
            {currentView.replace(/([A-Z])/g, ' $1').trim()} feature is under development
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={handleViewChange} 
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;