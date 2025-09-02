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
    { 
      id: 'quick-create', 
      label: 'Quick Create', 
      icon: Plus, 
      type: 'button',
      className: 'bg-blue-600 text-white hover:bg-blue-700'
    },
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
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Header Section */}
      <div className="p-6 border-b border-gray-200">
        {/* System Title and Description */}
        <div className="mb-4">
          <div className="tracking-tight text-2xl md:text-3xl font-bold japanese-text">
            シフト管理システム
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Japanese Restaurant Shift Schedule Manager
          </p>
        </div>
        
        {/* Status and ID */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Badge className="border-transparent bg-primary text-primary-foreground hover:bg-primary/80">
              リアルタイム
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            ID: 502c037b...
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {/* Quick Create Button */}
          <Button 
            className="w-full mb-4 bg-blue-600 text-white hover:bg-blue-700 justify-start gap-2"
            onClick={() => onViewChange?.('create')}
          >
            <Plus size={16} />
            Quick Create
          </Button>

          {/* Main Navigation */}
          <nav className="space-y-1">
            {menuItems.slice(1).map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => onViewChange?.(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive 
                      ? 'bg-gray-100 text-gray-900 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Separator className="my-4" />

          {/* Documents Section */}
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Documents
            </h3>
            <nav className="space-y-1">
              {documentItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onViewChange?.(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <FileText size={16} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <Separator className="my-4" />

          {/* Utility Items */}
          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <Search size={16} />
              Search
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
              <HelpCircle size={16} />
              Get Help
            </button>
          </nav>
        </div>
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
            CN
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">shadcn</div>
            <div className="text-xs text-gray-500 truncate">m@example.com</div>
          </div>
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;