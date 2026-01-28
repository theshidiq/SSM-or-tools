import React from 'react';

const ProgressBar = ({ current, total, progress, language = 'ja' }) => {
  const sectionNames = {
    ja: [
      '時間効率',
      '正確性',
      '意思決定支援',
      'ユーザー体験',
      'ビジネス影響',
      '改善点',
      '総合評価',
    ],
    en: [
      'Time Efficiency',
      'Accuracy',
      'Decision Support',
      'User Experience',
      'Business Impact',
      'Improvements',
      'Overall',
    ],
  };

  const names = sectionNames[language];

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">
            {language === 'ja' ? 'セクション' : 'Section'} {current}/{total}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{names[current - 1]}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</p>
          <p className="text-xs text-gray-500">
            {language === 'ja' ? '完了' : 'Complete'}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
        </div>
      </div>

      {/* Section Dots */}
      <div className="flex justify-between mt-4">
        {names.map((name, index) => (
          <div key={index} className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                index + 1 < current
                  ? 'bg-green-500 text-white'
                  : index + 1 === current
                  ? 'bg-blue-600 text-white ring-4 ring-blue-200'
                  : 'bg-gray-200 text-gray-400'
              }`}
            >
              {index + 1 < current ? '✓' : index + 1}
            </div>
            <span className="text-xs text-gray-600 mt-1 hidden sm:block">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressBar;
