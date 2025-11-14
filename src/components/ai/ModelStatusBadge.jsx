/**
 * ModelStatusBadge.jsx
 *
 * Always-visible badge showing ML model training status
 * Clickable to open training modal
 */

import React, { useState } from 'react';
import { useModelTraining } from '../../hooks/useModelTraining';
import { ModelTrainingModal } from './ModelTrainingModal';

export const ModelStatusBadge = ({ className = '' }) => {
  const { modelStatus, isTraining, needsRetraining, getModelInfo } = useModelTraining();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const modelInfo = getModelInfo();

  // Determine badge color and icon
  const getBadgeStyle = () => {
    if (isTraining) {
      return {
        bg: 'bg-blue-100 border-blue-300',
        text: 'text-blue-800',
        icon: '🔄',
        label: 'トレーニング中',
        animate: 'animate-pulse',
      };
    }

    if (modelInfo.status === 'ready' && !needsRetraining) {
      return {
        bg: 'bg-green-100 border-green-300',
        text: 'text-green-800',
        icon: '✅',
        label: 'モデル準備完了',
        animate: '',
      };
    }

    if (modelInfo.status === 'needs_retraining') {
      return {
        bg: 'bg-yellow-100 border-yellow-300',
        text: 'text-yellow-800',
        icon: '⚠️',
        label: '再トレーニング推奨',
        animate: '',
      };
    }

    return {
      bg: 'bg-red-100 border-red-300',
      text: 'text-red-800',
      icon: '❌',
      label: 'トレーニング必要',
      animate: '',
    };
  };

  const style = getBadgeStyle();

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${style.bg} ${style.text} ${style.animate} ${className} hover:opacity-80 transition cursor-pointer`}
        title="クリックしてトレーニングモーダルを開く"
      >
        <span className="text-sm">{style.icon}</span>
        <span className="text-xs font-medium">{style.label}</span>
        {modelStatus.metadata?.accuracy && !isTraining && (
          <span className="text-xs opacity-75">
            ({(modelStatus.metadata.accuracy * 100).toFixed(0)}%)
          </span>
        )}
      </button>

      <ModelTrainingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
