import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import ProgressBar from './ProgressBar';
import { SurveySection2 } from './SurveySection2';
import { SurveySection3 } from './SurveySection3';
import { SurveySection4 } from './SurveySection4';
import { SurveySection5 } from './SurveySection5';
import { SurveySection6 } from './SurveySection6';
import { SurveySection7 } from './SurveySection7';
import { SurveySection8 } from './SurveySection8';
import { supabase } from '../../utils/supabaseClient';

/**
 * MultiStepSurveyForm - 7-section wizard form with progress tracking
 */
const MultiStepSurveyForm = ({ language = 'ja' }) => {
  const [currentSection, setCurrentSection] = useState(1);
  const [responseId, setResponseId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      language: language,
      current_section: 1,
      completed: false,
    },
  });

  const totalSections = 7;
  const progress = (currentSection / totalSections) * 100;

  // Auto-save to localStorage
  const formData = watch();
  useEffect(() => {
    const saveTimeout = setTimeout(() => {
      localStorage.setItem('research_survey_draft', JSON.stringify(formData));
    }, 1000);
    return () => clearTimeout(saveTimeout);
  }, [formData]);

  // Load draft on mount
  useEffect(() => {
    const draft = localStorage.getItem('research_survey_draft');
    if (draft) {
      try {
        const parsedDraft = JSON.parse(draft);
        Object.keys(parsedDraft).forEach((key) => {
          setValue(key, parsedDraft[key]);
        });
        if (parsedDraft.current_section) {
          setCurrentSection(parsedDraft.current_section);
        }
        if (parsedDraft.id) {
          setResponseId(parsedDraft.id);
        }
      } catch (e) {
        console.error('Failed to load draft:', e);
      }
    }
  }, [setValue]);

  const translations = {
    ja: {
      next: '次へ',
      previous: '前へ',
      submit: '送信',
      saving: '保存中...',
      reset: 'リセット',
      resetConfirm: '本当にすべての回答をクリアしてもよろしいですか？この操作は取り消せません。',
      successTitle: '送信完了',
      successMessage: 'ご協力ありがとうございました！',
      error: 'エラーが発生しました。もう一度お試しください。',
      validation: 'すべての必須項目に回答してください。',
    },
    en: {
      next: 'Next',
      previous: 'Previous',
      submit: 'Submit',
      saving: 'Saving...',
      reset: 'Reset',
      resetConfirm: 'Are you sure you want to clear all responses? This action cannot be undone.',
      successTitle: 'Submission Complete',
      successMessage: 'Thank you for your participation!',
      error: 'An error occurred. Please try again.',
      validation: 'Please answer all required questions.',
    },
  };

  const t = translations[language];

  const handleNext = async () => {
    // Validate current section
    const isValid = await trigger();
    if (!isValid) {
      alert(t.validation);
      return;
    }

    if (currentSection < totalSections) {
      const nextSection = currentSection + 1;
      setCurrentSection(nextSection);
      setValue('current_section', nextSection);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentSection > 1) {
      const prevSection = currentSection - 1;
      setCurrentSection(prevSection);
      setValue('current_section', prevSection);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleReset = () => {
    if (window.confirm(t.resetConfirm)) {
      // Clear localStorage draft
      localStorage.removeItem('research_survey_draft');

      // Reset form to default values
      const defaultValues = {
        language: language,
        current_section: 1,
        completed: false,
      };

      // Reset all form fields
      Object.keys(defaultValues).forEach((key) => {
        setValue(key, defaultValues[key]);
      });

      // Reset to first section
      setCurrentSection(1);
      setResponseId(null);

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Reload page to fully reset form state
      window.location.reload();
    }
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);

    try {
      const submissionData = {
        ...data,
        completed: true,
        current_section: 7,
        language: language,
      };

      let result;
      if (responseId) {
        // Update existing response
        result = await supabase
          .from('survey_responses')
          .update(submissionData)
          .eq('id', responseId)
          .select()
          .single();
      } else {
        // Create new response
        result = await supabase
          .from('survey_responses')
          .insert([submissionData])
          .select()
          .single();
      }

      if (result.error) throw result.error;

      // Clear draft
      localStorage.removeItem('research_survey_draft');

      // Show success message
      setShowSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Submission error:', error);
      alert(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.successTitle}</h2>
          <p className="text-gray-600 mb-6">{t.successMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {language === 'ja' ? '閉じる' : 'Close'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <ProgressBar current={currentSection} total={totalSections} progress={progress} language={language} />

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-xl p-8 mt-6">
        {/* Render current section */}
        {currentSection === 1 && <SurveySection2 register={register} errors={errors} language={language} />}
        {currentSection === 2 && <SurveySection3 register={register} errors={errors} language={language} />}
        {currentSection === 3 && <SurveySection4 register={register} errors={errors} language={language} />}
        {currentSection === 4 && <SurveySection5 register={register} errors={errors} language={language} />}
        {currentSection === 5 && <SurveySection6 register={register} errors={errors} language={language} />}
        {currentSection === 6 && <SurveySection7 register={register} errors={errors} language={language} />}
        {currentSection === 7 && <SurveySection8 register={register} errors={errors} language={language} />}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentSection === 1}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← {t.previous}
          </button>

          {currentSection < totalSections ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t.next} →
            </button>
          ) : (
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
            >
              {isSubmitting ? t.saving : `✓ ${t.submit}`}
            </button>
          )}
        </div>
      </form>

      {/* Auto-save indicator and Reset button */}
      <div className="flex justify-between items-center mt-4">
        <p className="text-sm text-gray-500">
          {language === 'ja'
            ? '💾 回答は自動的に保存されます'
            : '💾 Your responses are auto-saved'}
        </p>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
        >
          🔄 {t.reset}
        </button>
      </div>
    </div>
  );
};

export default MultiStepSurveyForm;
