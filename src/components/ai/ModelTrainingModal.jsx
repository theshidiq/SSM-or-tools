/**
 * ModelTrainingModal.jsx
 *
 * Stub modal - OR-Tools doesn't need training
 * Kept for backward compatibility with imports
 */

import React from "react";

export const ModelTrainingModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h2 className="text-lg font-semibold mb-4">OR-Tools 最適化エンジン</h2>
        <p className="text-gray-600 mb-4">
          OR-Tools は Google の制約プログラミングソルバーです。
          機械学習と違い、トレーニングは不要です。
        </p>
        <p className="text-sm text-gray-500 mb-4">
          スケジュール生成時に自動的に最適解を計算します。
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModelTrainingModal;
