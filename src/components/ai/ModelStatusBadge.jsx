/**
 * ModelStatusBadge.jsx
 *
 * Shows OR-Tools optimizer status (replaces legacy TensorFlow ML badge)
 * OR-Tools is always ready - no training needed
 */

import React from "react";

export const ModelStatusBadge = ({ className = "" }) => {
  // OR-Tools is always ready - no training required
  const style = {
    bg: "bg-green-100 border-green-300",
    text: "text-green-800",
    icon: "✅",
    label: "OR-Tools 準備完了",
  };

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.bg} ${style.text} ${className}`}
      title="OR-Tools Constraint Solver - Always Ready"
    >
      <span className="text-sm">{style.icon}</span>
      <span className="text-xs font-medium">{style.label}</span>
    </div>
  );
};

export default ModelStatusBadge;
