import React from 'react';
import { 
  Calendar,
  BarChart3,
  Users,
  Settings,
  FileText,
  HelpCircle,
  Search,
  Plus,
  ChevronDown
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

const Sidebar = ({ currentView, onViewChange }) => {
  const menuItems = [
    { id: 'schedule', label: 'Schedule', icon: Calendar, type: 'nav' },
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, type: 'nav' },
    { id: 'staff', label: 'Staff', icon: Users, type: 'nav' },
    { id: 'reports', label: 'Reports', icon: FileText, type: 'nav' },
    { id: 'settings', label: 'Settings', icon: Settings, type: 'nav' },
  ];

  const documentItems = [
    { id: 'schedules', label: 'Schedules' },
    { id: 'templates', label: 'Templates' },
    { id: 'reports', label: 'Reports' },
  ];

  return (
    <div className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Header Section */}
      <div className="p-6 border-b border-sidebar-border">
        {/* System Title */}
        <div className="mb-4">
          <div className="tracking-tight text-2xl md:text-3xl font-bold japanese-text text-sidebar-foreground">
            湖南荘
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Quick Create Button */}
          <Button 
            className="w-full mb-4 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 justify-start gap-2 transition-all duration-200"
            onClick={() => onViewChange?.('create')}
          >
            <Plus size={16} />
            Quick Create
          </Button>

          {/* Main Navigation */}
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange?.(item.id)}
                  className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                >
                  <Icon size={16} className="transition-transform duration-200 group-hover:scale-105" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Separator className="my-4" />

          {/* Documents Section */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-1">
              Documents
            </h3>
            <nav className="space-y-1">
              {documentItems.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange?.(item.id)}
                    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                      isActive 
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' 
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <FileText size={16} className="transition-transform duration-200 group-hover:scale-105" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <Separator className="my-4" />

          {/* Utility Items */}
          <nav className="space-y-1">
            <button className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
              <Search size={16} className="transition-transform duration-200 group-hover:scale-105" />
              Search
            </button>
            <button className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
              <HelpCircle size={16} className="transition-transform duration-200 group-hover:scale-105" />
              Get Help
            </button>
          </nav>
        </div>
      </div>

      {/* Status and User Section */}
      <div className="p-4 border-t border-sidebar-border">
        {/* Status and ID */}
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Badge className="border-transparent bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 transition-all duration-200">
              リアルタイム
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            ID: 502c037b...
          </span>
        </div>
        
        {/* User Profile */}
        <div className="group flex items-center gap-3 p-2 rounded-md hover:bg-sidebar-accent transition-all duration-200 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-sm font-medium">
            CN
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground group-hover:text-sidebar-accent-foreground transition-colors duration-200">shadcn</div>
            <div className="text-xs text-muted-foreground truncate">m@example.com</div>
          </div>
          <ChevronDown size={16} className="text-muted-foreground group-hover:text-sidebar-accent-foreground transition-all duration-200" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;