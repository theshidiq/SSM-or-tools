/**
 * KeyboardShortcutsHelp - Help overlay showing keyboard shortcuts
 */

import React from "react";
import { X, Keyboard } from "lucide-react";

const KeyboardShortcutsHelp = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  const shortcuts = [
    {
      category: "Navigation",
      shortcuts: [
        { keys: ["Arrow Keys"], description: "Navigate between cells" },
        { keys: ["Tab"], description: "Move to next cell" },
        { keys: ["Shift", "Arrow"], description: "Extend selection" },
      ],
    },
    {
      category: "Quick Shift Entry",
      shortcuts: [
        { keys: ["1"], description: "Early shift (△)" },
        { keys: ["2"], description: "Normal shift (○)" },
        { keys: ["3"], description: "Late shift (▽)" },
        { keys: ["4", "X"], description: "Day off (×)" },
        { keys: ["Space", "Delete"], description: "Clear cell" },
      ],
    },
    {
      category: "Selection & Copy/Paste",
      shortcuts: [
        { keys: ["Ctrl", "A"], description: "Select all cells" },
        { keys: ["Ctrl", "C"], description: "Copy selected cells" },
        { keys: ["Ctrl", "V"], description: "Paste to selected cells" },
        { keys: ["Shift", "Click"], description: "Extend selection" },
        { keys: ["Ctrl", "Click"], description: "Add cell to selection" },
      ],
    },
    {
      category: "Tips",
      shortcuts: [
        { keys: [], description: "Drag to select multiple cells" },
        { keys: [], description: "Right-click for context menu" },
        { keys: [], description: "Use templates for common patterns" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Keyboard className="text-blue-600" size={24} />
            <h2 className="text-xl font-semibold text-gray-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {shortcuts.map((category, index) => (
            <div key={index}>
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, shortcutIndex) => (
                  <div
                    key={shortcutIndex}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-gray-700">
                      {shortcut.description}
                    </span>
                    {shortcut.keys.length > 0 && (
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-300 rounded">
                              {key}
                            </kbd>
                            {keyIndex < shortcut.keys.length - 1 && (
                              <span className="text-gray-400 mx-1">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
          <p className="text-sm text-gray-600">
            <strong>Pro tip:</strong> Select multiple cells and use number keys
            (1-4) to quickly assign shifts to all selected cells.
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;
