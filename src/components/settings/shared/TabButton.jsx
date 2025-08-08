import React from "react";
import { AlertTriangle } from "lucide-react";

const TabButton = ({
  id,
  label,
  icon,
  isActive = false,
  onClick,
  hasErrors = false,
  keyboardShortcut = null,
  disabled = false,
}) => {
  return (
    <button
      id={`tab-${id}`}
      role="tab"
      aria-selected={isActive}
      aria-controls={`tabpanel-${id}`}
      onClick={() => !disabled && onClick(id)}
      disabled={disabled}
      className={`relative flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : isActive
          ? "bg-white text-blue-700 border-2 border-blue-200 shadow-sm"
          : "text-gray-600 hover:text-gray-800 hover:bg-white/50"
      }`}
      title={keyboardShortcut ? `${label} (${keyboardShortcut})` : label}
    >
      {/* Icon */}
      <span className="mr-2 text-lg" role="img" aria-label={label}>
        {icon}
      </span>
      
      {/* Label */}
      <span className="whitespace-nowrap">{label}</span>
      
      {/* Error indicator */}
      {hasErrors && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
          <AlertTriangle size={12} className="text-white" />
        </div>
      )}
      
      {/* Keyboard shortcut hint */}
      {keyboardShortcut && !isActive && (
        <span className="ml-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
          {keyboardShortcut.replace("Ctrl", "⌘")}
        </span>
      )}
    </button>
  );
};

export default TabButton;