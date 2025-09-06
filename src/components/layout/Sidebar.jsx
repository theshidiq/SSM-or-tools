import React from "react";
import {
  Calendar,
  Settings,
  HelpCircle,
  Monitor,
  CalendarDays,
  Menu,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";

const Sidebar = ({ currentView = "schedule", onViewChange }) => {
  const menuItems = [
    { id: "schedule", label: "Schedule", icon: Calendar, type: "nav" },
    { id: "monitor", label: "Monitor", icon: Monitor, type: "nav" },
    { id: "calendar", label: "Calendar", icon: CalendarDays, type: "nav" },
    { id: "menu", label: "Menu", icon: Menu, type: "nav" },
    { id: "alergi", label: "Alergi", icon: AlertTriangle, type: "nav" },
    { id: "settings", label: "Settings", icon: Settings, type: "nav" },
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
          {/* Section Title */}
          <div className="w-full mb-4 px-3 py-2.5">
            <h2 className="text-xl font-bold text-sidebar-foreground">
              調理場
            </h2>
          </div>

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
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-secondary hover:text-secondary-foreground"
                  }`}
                >
                  <Icon
                    size={16}
                    className="transition-transform duration-200 group-hover:scale-105"
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <Separator className="my-4" />

          {/* Utility Items */}
          <nav className="space-y-1">
            <button className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-secondary hover:text-secondary-foreground transition-all duration-200">
              <HelpCircle
                size={16}
                className="transition-transform duration-200 group-hover:scale-105"
              />
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
        <div className="group flex items-center gap-3 p-2 rounded-md hover:bg-secondary transition-all duration-200 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
            KS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground group-hover:text-secondary-foreground transition-colors duration-200">
              Kamal Ashidiq
            </div>
            <div className="text-xs text-muted-foreground truncate">
              k@shidiq.com
            </div>
          </div>
          <ChevronDown
            size={16}
            className="text-muted-foreground group-hover:text-secondary-foreground transition-all duration-200"
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
