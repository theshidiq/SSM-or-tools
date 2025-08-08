import React from "react";

const ToggleSwitch = ({
  label,
  checked = false,
  onChange,
  disabled = false,
  description = "",
  size = "medium", // small, medium, large
  colorScheme = "blue", // blue, green, purple, orange, red
  showLabels = false,
  onLabel = "On",
  offLabel = "Off",
}) => {
  const sizeClasses = {
    small: {
      container: "w-9 h-5",
      thumb: "w-4 h-4",
      translate: "translate-x-4",
    },
    medium: {
      container: "w-11 h-6",
      thumb: "w-5 h-5",
      translate: "translate-x-5",
    },
    large: {
      container: "w-14 h-7",
      thumb: "w-6 h-6",
      translate: "translate-x-7",
    },
  };

  const colorClasses = {
    blue: "bg-blue-600",
    green: "bg-green-600",
    purple: "bg-purple-600",
    orange: "bg-orange-600",
    red: "bg-red-600",
  };

  const sizeConfig = sizeClasses[size] || sizeClasses.medium;
  const activeColor = colorClasses[colorScheme] || colorClasses.blue;

  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        {label && (
          <label className="text-sm font-medium text-gray-700 block">
            {label}
          </label>
        )}
        {description && (
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {showLabels && (
          <span className={`text-sm ${!checked ? "font-medium text-gray-900" : "text-gray-500"}`}>
            {offLabel}
          </span>
        )}
        
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={label}
          onClick={() => !disabled && onChange(!checked)}
          disabled={disabled}
          className={`${sizeConfig.container} relative inline-flex flex-shrink-0 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            disabled
              ? "opacity-50 cursor-not-allowed bg-gray-200"
              : checked
              ? activeColor
              : "bg-gray-200"
          }`}
        >
          <span
            aria-hidden="true"
            className={`${sizeConfig.thumb} pointer-events-none inline-block rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
              checked ? sizeConfig.translate : "translate-x-0"
            }`}
          />
        </button>
        
        {showLabels && (
          <span className={`text-sm ${checked ? "font-medium text-gray-900" : "text-gray-500"}`}>
            {onLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default ToggleSwitch;