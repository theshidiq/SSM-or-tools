import React from "react";
import { AlertTriangle, Info } from "lucide-react";

const FormField = ({
  label,
  children,
  error = "",
  description = "",
  required = false,
  className = "",
  orientation = "vertical", // vertical or horizontal
}) => {
  const fieldId = `field-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  if (orientation === "horizontal") {
    return (
      <div className={`flex items-start gap-4 ${className}`}>
        <div className="flex-shrink-0 w-1/3">
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-gray-700 block"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div id={fieldId}>{children}</div>

          {error && (
            <div className="flex items-start gap-2 mt-2">
              <AlertTriangle
                size={14}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-gray-700 block"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {description && (
        <div className="flex items-start gap-2">
          <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600">{description}</p>
        </div>
      )}

      <div id={fieldId}>{children}</div>

      {error && (
        <div className="flex items-start gap-2">
          <AlertTriangle
            size={14}
            className="text-red-500 flex-shrink-0 mt-0.5"
          />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
};

export default FormField;
