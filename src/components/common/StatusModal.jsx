import React, { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, Loader2, X } from "lucide-react";

const StatusModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = "confirm", // 'confirm', 'loading', 'success', 'error'
  confirmText = "Delete",
  cancelText = "Cancel",
  autoCloseDelay = null,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      // Add exit animation delay
      const timer = setTimeout(() => setIsVisible(false), 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (type === "success" && autoCloseDelay && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [type, autoCloseDelay, isOpen, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case "loading":
        return <Loader2 className="animate-spin text-blue-500" size={48} />;
      case "success":
        return <CheckCircle className="text-green-500" size={48} />;
      case "error":
        return <AlertTriangle className="text-red-500" size={48} />;
      default:
        return <AlertTriangle className="text-orange-500" size={48} />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case "confirm":
        return "bg-red-500 hover:bg-red-600 focus:ring-red-500";
      case "success":
        return "bg-green-500 hover:bg-green-600 focus:ring-green-500";
      default:
        return "bg-blue-500 hover:bg-blue-600 focus:ring-blue-500";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
      <div
        className={`bg-white rounded-lg p-6 w-full max-w-md mx-4 transform transition-all duration-300 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          {type !== "loading" && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">{getIcon()}</div>

          {/* Message */}
          <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
        </div>

        {/* Buttons */}
        {type === "confirm" && (
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${getButtonColor()}`}
            >
              {confirmText}
            </button>
          </div>
        )}

        {type === "loading" && (
          <div className="text-center">
            <div className="text-sm text-gray-500">Please wait...</div>
          </div>
        )}

        {(type === "success" || type === "error") && (
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className={`px-6 py-2 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${getButtonColor()}`}
            >
              OK
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusModal;
