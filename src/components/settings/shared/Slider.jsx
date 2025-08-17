import React from "react";

const Slider = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  showValue = true,
  unit = "",
  description = "",
  error = "",
  className = "",
  colorScheme = "blue", // blue, green, purple, orange, red
}) => {
  const colorClasses = {
    blue: {
      track: "bg-blue-200",
      thumb: "bg-blue-600 hover:bg-blue-700",
      focus: "focus:ring-blue-500",
    },
    green: {
      track: "bg-green-200",
      thumb: "bg-green-600 hover:bg-green-700",
      focus: "focus:ring-green-500",
    },
    purple: {
      track: "bg-purple-200",
      thumb: "bg-purple-600 hover:bg-purple-700",
      focus: "focus:ring-purple-500",
    },
    orange: {
      track: "bg-orange-200",
      thumb: "bg-orange-600 hover:bg-orange-700",
      focus: "focus:ring-orange-500",
    },
    red: {
      track: "bg-red-200",
      thumb: "bg-red-600 hover:bg-red-700",
      focus: "focus:ring-red-500",
    },
  };

  const colors = colorClasses[colorScheme] || colorClasses.blue;
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label and Value */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {showValue && (
          <span
            className={`text-sm font-semibold ${error ? "text-red-600" : "text-gray-900"}`}
          >
            {value}
            {unit}
          </span>
        )}
      </div>

      {/* Description */}
      {description && <p className="text-xs text-gray-500">{description}</p>}

      {/* Slider Container */}
      <div className="relative">
        {/* Track */}
        <div
          className={`w-full h-2 rounded-full ${disabled ? "bg-gray-200" : "bg-gray-200"}`}
        >
          {/* Progress */}
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              disabled ? "bg-gray-300" : colors.track
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Slider Input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className={`absolute inset-0 w-full h-2 opacity-0 cursor-pointer focus:outline-none ${
            disabled ? "cursor-not-allowed" : ""
          }`}
        />

        {/* Thumb */}
        <div
          className={`absolute top-1/2 w-5 h-5 rounded-full border-2 border-white shadow-lg transform -translate-y-1/2 transition-all duration-200 ${
            disabled
              ? "bg-gray-400 cursor-not-allowed"
              : `${colors.thumb} cursor-pointer hover:scale-110`
          }`}
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>

      {/* Min/Max Labels */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>

      {/* Error Message */}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
};

export default Slider;
