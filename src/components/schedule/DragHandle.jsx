import React, { useState, useCallback } from "react";
import { MousePointer2 } from "lucide-react";

/**
 * Drag handle component for Excel-like drag-to-fill functionality
 */
const DragHandle = ({
  cellKey,
  selectedCells,
  onDragStart,
  onDragEnd,
  onDragPreview,
  position = "bottom-right",
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      setIsDragging(true);
      onDragStart && onDragStart(cellKey, event);

      const handleMouseMove = (moveEvent) => {
        onDragPreview && onDragPreview(moveEvent);
      };

      const handleMouseUp = (upEvent) => {
        setIsDragging(false);
        onDragEnd && onDragEnd(upEvent);

        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [cellKey, onDragStart, onDragEnd, onDragPreview],
  );

  // Only show drag handle on selected cells and when hovering
  if (!selectedCells.has(cellKey)) return null;

  // Position styles based on position prop
  const positionStyles = {
    "bottom-right": "bottom-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "top-right": "top-0 right-0",
    "top-left": "top-0 left-0",
  };

  return (
    <div
      className={`absolute ${positionStyles[position]} w-2 h-2 bg-blue-600 cursor-crosshair z-10 transform translate-x-1 translate-y-1 hover:scale-125 transition-transform opacity-80 hover:opacity-100`}
      style={{
        transform: position.includes("right")
          ? "translate(50%, 50%)"
          : position.includes("left")
            ? "translate(-50%, 50%)"
            : "translate(50%, 50%)",
      }}
      onMouseDown={handleMouseDown}
      title="Drag to fill pattern"
    >
      {isDragging && (
        <div className="absolute inset-0 w-3 h-3 bg-blue-500 border border-blue-700 rounded-sm -translate-x-1/4 -translate-y-1/4" />
      )}
    </div>
  );
};

export default DragHandle;
