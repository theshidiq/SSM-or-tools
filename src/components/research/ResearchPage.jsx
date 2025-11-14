import React, { useState } from 'react';
import MultiStepSurveyForm from './MultiStepSurveyForm';
import ResultsDashboard from './ResultsDashboard';

/**
 * ResearchPage - Main page for shift scheduling research survey
 * Features:
 * - Multi-step survey form (8 sections)
 * - Real-time analytics dashboard
 * - Tab switching between form and results
 */
const ResearchPage = () => {
  const [activeTab, setActiveTab] = useState('survey'); // 'survey' or 'results'
  const [language, setLanguage] = useState('ja'); // 'ja' or 'en'

  const translations = {
    ja: {
      title: 'シフト作成システム研究調査',
      subtitle: '手動シフト作成 vs AI支援システムの比較評価',
      surveyTab: 'アンケート',
      resultsTab: '結果・分析',
      languageToggle: 'English',
      backToHome: 'ホームに戻る',
    },
    en: {
      title: 'Shift Scheduling System Research',
      subtitle: 'Manual vs AI-Assisted System Comparison',
      surveyTab: 'Survey',
      resultsTab: 'Results',
      languageToggle: '日本語',
      backToHome: 'Back to Home',
    },
  };

  const t = translations[language];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-blue-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            {/* Left: Back button and Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title={t.backToHome}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                <span className="font-medium">{t.backToHome}</span>
              </button>
              <div className="border-l border-gray-300 h-12"></div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{t.title}</h1>
                <p className="text-gray-600 mt-1">{t.subtitle}</p>
              </div>
            </div>

            {/* Right: Language toggle */}
            <button
              onClick={() => setLanguage(language === 'ja' ? 'en' : 'ja')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
            >
              {t.languageToggle}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('survey')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'survey'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📝 {t.surveyTab}
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'results'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 {t.resultsTab}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'survey' ? (
          <MultiStepSurveyForm language={language} />
        ) : (
          <ResultsDashboard language={language} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            {language === 'ja'
              ? 'すべての回答は匿名で処理されます。ご協力ありがとうございます。'
              : 'All responses are processed anonymously. Thank you for your participation.'}
          </p>
          <p className="text-center text-xs text-gray-400 mt-2">
            Shift Schedule Manager Research Project • Version 1.0
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ResearchPage;
