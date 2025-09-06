/**
 * LoadingStates.jsx
 *
 * Reusable loading state components for lazy loaded features
 */

import React from "react";

// AI Feature Loading Spinner
export const AILoadingSpinner = ({ message = "Loading AI features..." }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="absolute inset-0 rounded-full h-12 w-12 border-t-2 border-blue-300 opacity-25 animate-pulse"></div>
      </div>
      <div className="text-gray-600 text-sm font-medium">{message}</div>
      <div className="text-gray-400 text-xs">
        This may take a moment for first-time loading...
      </div>
    </div>
  );
};

// Skeleton loader for AI assistant components
export const AIAssistantSkeleton = () => {
  return (
    <div className="animate-pulse space-y-4 p-6 border rounded-lg bg-gray-50">
      <div className="flex items-center space-x-3">
        <div className="rounded-full bg-gray-300 h-8 w-8"></div>
        <div className="h-4 bg-gray-300 rounded w-32"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-300 rounded w-full"></div>
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
      </div>
      <div className="flex space-x-2">
        <div className="h-8 bg-gray-300 rounded w-20"></div>
        <div className="h-8 bg-gray-300 rounded w-24"></div>
      </div>
    </div>
  );
};

// Simple loading spinner for smaller components
export const SimpleSpinner = ({ size = "md", color = "blue" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-12 w-12",
  };

  const colorClasses = {
    blue: "border-blue-600",
    gray: "border-gray-600",
    green: "border-green-600",
    purple: "border-purple-600",
  };

  return (
    <div
      className={`animate-spin rounded-full border-b-2 ${sizeClasses[size]} ${colorClasses[color]}`}
    ></div>
  );
};

// Loading state for debug tools
export const DebugToolsLoading = () => {
  return (
    <div className="fixed top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80 z-50 animate-pulse">
      <div className="space-y-3">
        <div className="h-4 bg-gray-300 rounded w-48"></div>
        <div className="bg-gray-50 rounded p-2 space-y-2">
          <div className="h-3 bg-gray-300 rounded w-full"></div>
          <div className="h-3 bg-gray-300 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
        <div className="h-8 bg-gray-300 rounded w-full"></div>
      </div>
    </div>
  );
};

// Feature loading progress indicator
export const FeatureLoadingProgress = ({
  features = [],
  currentFeature = "",
  progress = 0,
}) => {
  return (
    <div className="space-y-4 p-6 bg-white border rounded-lg shadow-sm">
      <div className="text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Loading AI Features
        </h3>
        <div className="text-sm text-gray-600 mb-4">
          {currentFeature || "Initializing..."}
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        ></div>
      </div>

      <div className="text-xs text-gray-500 text-center">
        {Math.round(progress)}% complete
      </div>

      {features.length > 0 && (
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              <div
                className={`w-2 h-2 rounded-full ${
                  feature.loaded
                    ? "bg-green-500"
                    : feature.loading
                      ? "bg-blue-500 animate-pulse"
                      : "bg-gray-300"
                }`}
              ></div>
              <span
                className={feature.loaded ? "text-gray-600" : "text-gray-400"}
              >
                {feature.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default {
  AILoadingSpinner,
  AIAssistantSkeleton,
  SimpleSpinner,
  DebugToolsLoading,
  FeatureLoadingProgress,
};
