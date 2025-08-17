import React from "react";
import { Minus, Plus } from "lucide-react";

const NumberInput = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  disabled = false,
  placeholder = "",
  unit = "",
  error = "",
  description = "",
  showControls = true,
  size = "medium", // small, medium, large
  className = "",
}) => {
  const sizeClasses = {
    small: "px-2 py-1 text-sm",
    medium: "px-3 py-2 text-sm",
    large: "px-4 py-3 text-base",
  };

  const handleIncrement = () => {
    if (disabled) return;
    const newValue = Math.min(max, value + step);
    onChange(newValue);
  };

  const handleDecrement = () => {
    if (disabled) return;
    const newValue = Math.max(min, value - step);
    onChange(newValue);
  };

  const handleInputChange = (e) => {
    if (disabled) return;
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      const clampedValue = Math.min(max, Math.max(min, newValue));
      onChange(clampedValue);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 block">
          {label}
        </label>
      )}

      {description && <p className="text-xs text-gray-500">{description}</p>}

      <div className="relative">
        {showControls && (
          <button
            type="button"
            onClick={handleDecrement}
            disabled={disabled || value <= min}
            className={`absolute left-1 top-1/2 transform -translate-y-1/2 z-10 p-1 rounded hover:bg-gray-100 transition-colors ${
              disabled || value <= min
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-800"
            }`}
            title="Decrease"
          >
            <Minus size={14} />
          </button>
        )}

        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
            showControls ? "pl-8 pr-12" : "px-3"
          } ${sizeClasses[size]} ${
            error
              ? "border-red-300 bg-red-50"
              : disabled
                ? "bg-gray-100 text-gray-500"
                : "bg-white"
          }`}
        />

        {unit && (
          <div className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            {unit}
          </div>
        )}

        {showControls && (
          <button
            type="button"
            onClick={handleIncrement}
            disabled={disabled || value >= max}
            className={`absolute right-1 top-1/2 transform -translate-y-1/2 z-10 p-1 rounded hover:bg-gray-100 transition-colors ${
              disabled || value >= max
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:text-gray-800"
            }`}
            title="Increase"
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Min/Max Info */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          Min: {min}
          {unit}
        </span>
        <span>
          Max: {max}
          {unit}
        </span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default NumberInput;
