import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger", // "danger" or "warning" or "info"
  isLoading = false,
}) => {
  const modalRef = useRef(null);

  // Focus management and escape key handling
  useEffect(() => {
    console.log("🗑️ [MODAL] ConfirmationModal isOpen changed:", isOpen);
    if (isOpen && modalRef.current) {
      console.log("🗑️ [MODAL] Focusing modal element");
      modalRef.current.focus();
    }
  }, [isOpen]);

  // Hide all select elements when modal is open to prevent z-index issues
  useEffect(() => {
    if (isOpen) {
      // Add class to body to hide all select elements
      document.body.classList.add("confirmation-modal-open");

      // Also hide select elements directly as a fallback
      const selects = document.querySelectorAll("select");
      selects.forEach((select) => {
        select.setAttribute("data-hidden-by-modal", "true");
        select.style.display = "none";
      });
    }

    // Cleanup function runs when component unmounts OR when isOpen changes
    return () => {
      // Remove class and restore select elements
      document.body.classList.remove("confirmation-modal-open");

      const selects = document.querySelectorAll(
        'select[data-hidden-by-modal="true"]',
      );
      selects.forEach((select) => {
        select.removeAttribute("data-hidden-by-modal");
        select.style.display = "";
      });
    };
  }, [isOpen]);

  console.log("🗑️ [MODAL] ConfirmationModal rendering, isOpen:", isOpen);
  if (!isOpen) {
    console.log("🗑️ [MODAL] Modal not open, returning null");
    return null;
  }
  console.log("🗑️ [MODAL] Modal is open, creating portal");

  const variantStyles = {
    danger: {
      icon: "text-red-600",
      iconBg: "bg-red-100",
      button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: "text-yellow-600",
      iconBg: "bg-yellow-100",
      button: "bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500",
    },
    info: {
      icon: "text-blue-600",
      iconBg: "bg-blue-100",
      button: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      e.stopPropagation(); // Prevent event from bubbling to parent modals
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation(); // Prevent event from bubbling to parent modals
      onClose();
    } else if (e.key === "Enter" && !isLoading && onConfirm) {
      e.stopPropagation(); // Prevent event from bubbling to parent modals
      onConfirm();
    }
  };

  const handleConfirmClick = (e) => {
    e.stopPropagation(); // Prevent event from bubbling to parent modals
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCancelClick = (e) => {
    e.stopPropagation(); // Prevent event from bubbling to parent modals
    onClose();
  };

  // Use React Portal to render outside parent DOM hierarchy
  const modal = (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      style={{
        zIndex: 99999,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto", // Override Radix Dialog's pointer-events: none
      }}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-2xl transform transition-all"
        role="document"
      >
        <div
          className="p-6"
          onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from bubbling
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${styles.iconBg}`}>
                <AlertTriangle size={24} className={styles.icon} />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            </div>
            <button
              onClick={handleCancelClick}
              disabled={isLoading}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Message */}
          <div className="mb-6">
            <p className="text-gray-600">{message}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={handleCancelClick}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {cancelText}
            </button>
            {confirmText && (
              <button
                onClick={handleConfirmClick}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.button}`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </div>
                ) : (
                  confirmText
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render using React Portal to bypass parent stacking context
  return createPortal(modal, document.body);
};

export default ConfirmationModal;
