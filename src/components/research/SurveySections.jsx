import React from 'react';

// Shared components
const QuestionLabel = ({ children, required = false }) => (
  <label className="block text-sm font-medium text-gray-700 mb-2">
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);

const RadioGroup = ({ name, options, register, required = false, error }) => (
  <div className="space-y-2">
    {options.map((option) => (
      <label key={option.value} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
        <input
          type="radio"
          {...register(name, { required })}
          value={option.value}
          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-700">{option.label}</span>
      </label>
    ))}
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
  </div>
);

const RatingScale = ({ name, register, required = false, error }) => (
  <div className="flex items-center space-x-4">
    <span className="text-sm text-gray-500">1</span>
    {[1, 2, 3, 4, 5].map((rating) => (
      <label key={rating} className="cursor-pointer">
        <input
          type="radio"
          {...register(name, { required })}
          value={rating}
          className="sr-only peer"
        />
        <div className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 hover:border-blue-400 transition-all font-medium">
          {rating}
        </div>
      </label>
    ))}
    <span className="text-sm text-gray-500">5</span>
    {error && <p className="text-red-500 text-sm ml-4">{error.message}</p>}
  </div>
);

const TextArea = ({ name, register, rows = 3, placeholder = '', error }) => (
  <>
    <textarea
      {...register(name)}
      rows={rows}
      placeholder={placeholder}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
  </>
);

// Section 1: Background Information
export const SurveySection1 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション1: 基本情報',
    position: '現在の役職を教えてください',
    experience: 'シフト作成の経験年数は？',
    staffCount: '管理しているスタッフ数は？',
    manualDuration: '手動シフト作成の経験期間は？',
    aiDuration: 'AI支援システムの使用期間は？',
    years: '年',
    months: 'ヶ月',
  } : {
    title: 'Section 1: Background Information',
    position: 'What is your current position?',
    experience: 'How many years of shift scheduling experience do you have?',
    staffCount: 'How many staff members do you manage?',
    manualDuration: 'How long did you use manual shift scheduling?',
    aiDuration: 'How long have you used the AI-assisted system?',
    years: 'years',
    months: 'months',
  };

  const positions = language === 'ja' ? [
    { value: 'restaurant_manager', label: 'レストランマネージャー' },
    { value: 'shift_supervisor', label: 'シフト管理責任者' },
    { value: 'assistant_manager', label: '副マネージャー' },
    { value: 'other', label: 'その他' },
  ] : [
    { value: 'restaurant_manager', label: 'Restaurant Manager' },
    { value: 'shift_supervisor', label: 'Shift Supervisor' },
    { value: 'assistant_manager', label: 'Assistant Manager' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.position}</QuestionLabel>
        <RadioGroup name="position" options={positions} register={register} required error={errors.position} />
      </div>

      <div>
        <QuestionLabel required>{t.experience}</QuestionLabel>
        <RadioGroup
          name="experience_years"
          options={[
            { value: 'less_than_1', label: language === 'ja' ? '1年未満' : 'Less than 1 year' },
            { value: '1_to_3', label: '1-3' + (language === 'ja' ? '年' : ' years') },
            { value: '3_to_5', label: '3-5' + (language === 'ja' ? '年' : ' years') },
            { value: 'more_than_5', label: language === 'ja' ? '5年以上' : 'More than 5 years' },
          ]}
          register={register}
          required
          error={errors.experience_years}
        />
      </div>

      <div>
        <QuestionLabel required>{t.staffCount}</QuestionLabel>
        <RadioGroup
          name="staff_count"
          options={[
            { value: '5_to_10', label: '5-10' + (language === 'ja' ? '人' : ' people') },
            { value: '11_to_20', label: '11-20' + (language === 'ja' ? '人' : ' people') },
            { value: '21_to_30', label: '21-30' + (language === 'ja' ? '人' : ' people') },
            { value: 'more_than_31', label: language === 'ja' ? '31人以上' : 'More than 31 people' },
          ]}
          register={register}
          required
          error={errors.staff_count}
        />
      </div>
    </div>
  );
};

// Section 2: Time Efficiency
export const SurveySection2 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション2: 時間効率',
    manualTime: '手動方式で1期分のシフト作成にかかった平均時間は？',
    aiTime: 'AI支援システムで1期分のシフト作成にかかる平均時間は？',
    satisfaction: '時間削減について、どの程度満足していますか？',
    reason: '理由を教えてください',
  } : {
    title: 'Section 2: Time Efficiency',
    manualTime: 'How long did it take to create one schedule period manually?',
    aiTime: 'How long does it take with the AI-assisted system?',
    satisfaction: 'How satisfied are you with the time savings?',
    reason: 'Please explain why',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.manualTime}</QuestionLabel>
        <RadioGroup
          name="manual_time_category"
          options={[
            { value: 'less_than_1hr', label: language === 'ja' ? '1時間未満' : 'Less than 1 hour' },
            { value: '1_to_2hr', label: '1-2' + (language === 'ja' ? '時間' : ' hours') },
            { value: '2_to_3hr', label: '2-3' + (language === 'ja' ? '時間' : ' hours') },
            { value: '3_to_4hr', label: '3-4' + (language === 'ja' ? '時間' : ' hours') },
            { value: 'more_than_4hr', label: language === 'ja' ? '4時間以上' : 'More than 4 hours' },
          ]}
          register={register}
          required
          error={errors.manual_time_category}
        />
      </div>

      <div>
        <QuestionLabel required>{t.aiTime}</QuestionLabel>
        <RadioGroup
          name="ai_time_category"
          options={[
            { value: 'less_than_5min', label: language === 'ja' ? '5分未満' : 'Less than 5 minutes' },
            { value: '5_to_10min', label: '5-10' + (language === 'ja' ? '分' : ' minutes') },
            { value: '10_to_20min', label: '10-20' + (language === 'ja' ? '分' : ' minutes') },
            { value: '20_to_30min', label: '20-30' + (language === 'ja' ? '分' : ' minutes') },
            { value: 'more_than_30min', label: language === 'ja' ? '30分以上' : 'More than 30 minutes' },
          ]}
          register={register}
          required
          error={errors.ai_time_category}
        />
      </div>

      <div>
        <QuestionLabel required>{t.satisfaction}</QuestionLabel>
        <RatingScale name="time_satisfaction" register={register} required error={errors.time_satisfaction} />
      </div>

      <div>
        <QuestionLabel>{t.reason}</QuestionLabel>
        <TextArea name="time_satisfaction_reason" register={register} error={errors.time_satisfaction_reason} />
      </div>
    </div>
  );
};

// Section 3: Accuracy and Quality
export const SurveySection3 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション3: 正確性と品質',
    manualViolations: '手動方式で、制約違反はどのくらい発生しましたか？',
    aiViolations: 'AI支援システムでの制約違反の頻度は？',
    accuracySatisfaction: 'システムの制約チェック精度について、どの程度満足していますか？',
    manualFairness: '手動方式でのスケジュールの公平性をどう評価しますか？',
    aiFairness: 'AI支援システムでのスケジュールの公平性をどう評価しますか？',
    patternUnderstanding: 'AIシステムは、スタッフの希望やパターンをどの程度理解していると感じますか？',
  } : {
    title: 'Section 3: Accuracy and Quality',
    manualViolations: 'How often did constraint violations occur with manual scheduling?',
    aiViolations: 'How often do constraint violations occur with the AI system?',
    accuracySatisfaction: 'How satisfied are you with the constraint validation accuracy?',
    manualFairness: 'How would you rate the fairness of manual schedules?',
    aiFairness: 'How would you rate the fairness of AI-generated schedules?',
    patternUnderstanding: 'How well does the AI system understand staff preferences and patterns?',
  };

  const frequencies = language === 'ja' ? [
    { value: 'almost_always', label: 'ほぼ毎回' },
    { value: 'frequently', label: '頻繁に (50%+)' },
    { value: 'sometimes', label: '時々 (20-50%)' },
    { value: 'rarely', label: 'まれに (<20%)' },
    { value: 'never', label: '全くない' },
  ] : [
    { value: 'almost_always', label: 'Almost always' },
    { value: 'frequently', label: 'Frequently (50%+)' },
    { value: 'sometimes', label: 'Sometimes (20-50%)' },
    { value: 'rarely', label: 'Rarely (<20%)' },
    { value: 'never', label: 'Never' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.manualViolations}</QuestionLabel>
        <RadioGroup name="manual_violation_frequency" options={frequencies} register={register} required error={errors.manual_violation_frequency} />
      </div>

      <div>
        <QuestionLabel required>{t.aiViolations}</QuestionLabel>
        <RadioGroup name="ai_violation_frequency" options={frequencies} register={register} required error={errors.ai_violation_frequency} />
      </div>

      <div>
        <QuestionLabel required>{t.accuracySatisfaction}</QuestionLabel>
        <RatingScale name="constraint_accuracy_satisfaction" register={register} required error={errors.constraint_accuracy_satisfaction} />
      </div>

      <div>
        <QuestionLabel required>{t.manualFairness}</QuestionLabel>
        <RatingScale name="manual_fairness_rating" register={register} required error={errors.manual_fairness_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.aiFairness}</QuestionLabel>
        <RatingScale name="ai_fairness_rating" register={register} required error={errors.ai_fairness_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.patternUnderstanding}</QuestionLabel>
        <RatingScale name="ai_pattern_understanding" register={register} required error={errors.ai_pattern_understanding} />
      </div>
    </div>
  );
};

// Section 4: Decision Support
export const SurveySection4 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション4: 意思決定支援',
    trust: 'AIのスケジュール提案は、どの程度信頼できると感じますか？',
    patternUsefulness: 'パターン認識機能は役立っていますか？',
    optimizationUsage: '自動最適化機能を使用していますか？',
    decisionQuality: 'AI支援により、より良い意思決定ができるようになりましたか？',
  } : {
    title: 'Section 4: Decision Support',
    trust: 'How much do you trust the AI schedule recommendations?',
    patternUsefulness: 'Is the pattern recognition feature useful?',
    optimizationUsage: 'Do you use the automatic optimization feature?',
    decisionQuality: 'Has AI assistance improved your decision-making quality?',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.trust}</QuestionLabel>
        <RatingScale name="ai_trust_rating" register={register} required error={errors.ai_trust_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.patternUsefulness}</QuestionLabel>
        <RadioGroup
          name="pattern_recognition_usefulness"
          options={[
            { value: 'very_useful', label: language === 'ja' ? '非常に役立つ' : 'Very useful' },
            { value: 'useful', label: language === 'ja' ? '役立つ' : 'Useful' },
            { value: 'neutral', label: language === 'ja' ? 'どちらでもない' : 'Neutral' },
            { value: 'not_very_useful', label: language === 'ja' ? 'あまり役立たない' : 'Not very useful' },
            { value: 'not_useful', label: language === 'ja' ? '全く役立たない' : 'Not useful at all' },
          ]}
          register={register}
          required
          error={errors.pattern_recognition_usefulness}
        />
      </div>

      <div>
        <QuestionLabel required>{t.optimizationUsage}</QuestionLabel>
        <RadioGroup
          name="optimization_usage"
          options={[
            { value: 'always', label: language === 'ja' ? '常に使用' : 'Always use' },
            { value: 'frequently', label: language === 'ja' ? '頻繁に使用' : 'Frequently use' },
            { value: 'sometimes', label: language === 'ja' ? '時々使用' : 'Sometimes use' },
            { value: 'rarely', label: language === 'ja' ? 'まれに使用' : 'Rarely use' },
            { value: 'never', label: language === 'ja' ? '使用しない' : 'Never use' },
            { value: 'not_aware', label: language === 'ja' ? '機能を知らない' : 'Not aware of this feature' },
          ]}
          register={register}
          required
          error={errors.optimization_usage}
        />
      </div>

      <div>
        <QuestionLabel required>{t.decisionQuality}</QuestionLabel>
        <RatingScale name="decision_quality_improvement" register={register} required error={errors.decision_quality_improvement} />
      </div>
    </div>
  );
};

// Section 5: User Experience
export const SurveySection5 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション5: ユーザー体験',
    manualUsability: '手動方式の使いやすさをどう評価しますか？',
    aiUsability: 'AI支援システムの使いやすさをどう評価しますか？',
    learningDifficulty: 'システムの学習は簡単でしたか？',
    realtimeSync: 'リアルタイム同期機能は役立っていますか？',
    responseTime: 'システムの応答速度について満足していますか？',
  } : {
    title: 'Section 5: User Experience',
    manualUsability: 'How would you rate the usability of manual methods?',
    aiUsability: 'How would you rate the usability of the AI-assisted system?',
    learningDifficulty: 'Was the system easy to learn?',
    realtimeSync: 'Is the real-time synchronization feature useful?',
    responseTime: 'Are you satisfied with the system response time?',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.manualUsability}</QuestionLabel>
        <RatingScale name="manual_usability_rating" register={register} required error={errors.manual_usability_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.aiUsability}</QuestionLabel>
        <RatingScale name="ai_usability_rating" register={register} required error={errors.ai_usability_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.learningDifficulty}</QuestionLabel>
        <RadioGroup
          name="learning_difficulty"
          options={[
            { value: 'very_easy', label: language === 'ja' ? '非常に簡単' : 'Very easy' },
            { value: 'easy', label: language === 'ja' ? '簡単' : 'Easy' },
            { value: 'neutral', label: language === 'ja' ? '普通' : 'Neutral' },
            { value: 'difficult', label: language === 'ja' ? '難しい' : 'Difficult' },
            { value: 'very_difficult', label: language === 'ja' ? '非常に難しい' : 'Very difficult' },
          ]}
          register={register}
          required
          error={errors.learning_difficulty}
        />
      </div>

      <div>
        <QuestionLabel required>{t.realtimeSync}</QuestionLabel>
        <RatingScale name="realtime_sync_rating" register={register} required error={errors.realtime_sync_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.responseTime}</QuestionLabel>
        <RatingScale name="response_time_satisfaction" register={register} required error={errors.response_time_satisfaction} />
      </div>
    </div>
  );
};

// Section 6: Business Impact
export const SurveySection6 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション6: ビジネスインパクト',
    staffSatisfactionChange: 'AI導入後、スタッフの満足度は向上しましたか？',
    roi: '投資対効果をどう評価しますか？',
    managementEfficiency: 'マネージャーとしての業務効率は向上しましたか？',
    annualTimeSaved: '年間でどのくらいの時間を節約できていると感じますか？',
  } : {
    title: 'Section 6: Business Impact',
    staffSatisfactionChange: 'Has staff satisfaction improved after AI implementation?',
    roi: 'How would you rate the return on investment (ROI)?',
    managementEfficiency: 'Has your management efficiency improved?',
    annualTimeSaved: 'How much time do you save annually?',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.staffSatisfactionChange}</QuestionLabel>
        <RadioGroup
          name="staff_satisfaction_change"
          options={[
            { value: 'significantly_improved', label: language === 'ja' ? '大幅に向上' : 'Significantly improved' },
            { value: 'improved', label: language === 'ja' ? '向上' : 'Improved' },
            { value: 'no_change', label: language === 'ja' ? '変わらない' : 'No change' },
            { value: 'decreased', label: language === 'ja' ? '低下' : 'Decreased' },
            { value: 'significantly_decreased', label: language === 'ja' ? '大幅に低下' : 'Significantly decreased' },
          ]}
          register={register}
          required
          error={errors.staff_satisfaction_change}
        />
      </div>

      <div>
        <QuestionLabel required>{t.roi}</QuestionLabel>
        <RatingScale name="roi_rating" register={register} required error={errors.roi_rating} />
      </div>

      <div>
        <QuestionLabel required>{t.managementEfficiency}</QuestionLabel>
        <RatingScale name="management_efficiency" register={register} required error={errors.management_efficiency} />
      </div>

      <div>
        <QuestionLabel required>{t.annualTimeSaved}</QuestionLabel>
        <RadioGroup
          name="annual_time_saved"
          options={[
            { value: 'less_than_10hr', label: language === 'ja' ? '10時間未満' : 'Less than 10 hours' },
            { value: '10_to_20hr', label: '10-20' + (language === 'ja' ? '時間' : ' hours') },
            { value: '20_to_40hr', label: '20-40' + (language === 'ja' ? '時間' : ' hours') },
            { value: '40_to_60hr', label: '40-60' + (language === 'ja' ? '時間' : ' hours') },
            { value: 'more_than_60hr', label: language === 'ja' ? '60時間以上' : 'More than 60 hours' },
          ]}
          register={register}
          required
          error={errors.annual_time_saved}
        />
      </div>
    </div>
  );
};

// Section 7: Improvements and Future
export const SurveySection7 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション7: 改善と今後',
    recommendation: '他のレストランにこのシステムを推奨しますか？',
    continueUsing: '5年後もこのシステムを使い続けたいですか？',
    trainingSupport: 'システムトレーニング/サポートは十分でしたか？',
    futureExpectations: 'AI技術の進化により、今後どのような機能を期待しますか？',
  } : {
    title: 'Section 7: Improvements and Future',
    recommendation: 'Would you recommend this system to other restaurants?',
    continueUsing: 'Would you want to continue using this system in 5 years?',
    trainingSupport: 'Was the system training/support adequate?',
    futureExpectations: 'What features do you expect from future AI advancements?',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.recommendation}</QuestionLabel>
        <RadioGroup
          name="recommendation_level"
          options={[
            { value: 'highly_recommend', label: language === 'ja' ? '強く推奨' : 'Highly recommend' },
            { value: 'recommend', label: language === 'ja' ? '推奨' : 'Recommend' },
            { value: 'neutral', label: language === 'ja' ? 'どちらでもない' : 'Neutral' },
            { value: 'not_recommend', label: language === 'ja' ? '推奨しない' : 'Do not recommend' },
            { value: 'definitely_not_recommend', label: language === 'ja' ? '絶対に推奨しない' : 'Definitely do not recommend' },
          ]}
          register={register}
          required
          error={errors.recommendation_level}
        />
      </div>

      <div>
        <QuestionLabel required>{t.continueUsing}</QuestionLabel>
        <RadioGroup
          name="continue_using_5years"
          options={[
            { value: 'definitely_yes', label: language === 'ja' ? '絶対に使い続ける' : 'Definitely yes' },
            { value: 'probably_yes', label: language === 'ja' ? 'おそらく使い続ける' : 'Probably yes' },
            { value: 'unsure', label: language === 'ja' ? 'わからない' : 'Unsure' },
            { value: 'probably_change', label: language === 'ja' ? 'おそらく変更' : 'Probably change' },
            { value: 'definitely_change', label: language === 'ja' ? '絶対に変更' : 'Definitely change' },
          ]}
          register={register}
          required
          error={errors.continue_using_5years}
        />
      </div>

      <div>
        <QuestionLabel required>{t.trainingSupport}</QuestionLabel>
        <RatingScale name="training_support_rating" register={register} required error={errors.training_support_rating} />
      </div>

      <div>
        <QuestionLabel>{t.futureExpectations}</QuestionLabel>
        <TextArea name="future_feature_expectations" register={register} rows={4} error={errors.future_feature_expectations} />
      </div>
    </div>
  );
};

// Section 8: Overall Evaluation
export const SurveySection8 = ({ register, errors, language = 'ja' }) => {
  const t = language === 'ja' ? {
    title: 'セクション8: 総合評価',
    overallComparison: '全体的に、手動方式とAI支援システムを比較してどちらが優れていますか？',
    returnToManual: '手動方式に戻りたいと思いますか？',
    mostImpressive: 'AIシステムで最も印象的だった経験を教えてください',
    additionalComments: 'システムに関するその他のコメントや提案',
  } : {
    title: 'Section 8: Overall Evaluation',
    overallComparison: 'Overall, which system is better: manual or AI-assisted?',
    returnToManual: 'Would you want to go back to manual scheduling?',
    mostImpressive: 'Describe your most impressive experience with the AI system',
    additionalComments: 'Any other comments or suggestions about the system?',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.title}</h2>

      <div>
        <QuestionLabel required>{t.overallComparison}</QuestionLabel>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">{language === 'ja' ? '手動が最良' : 'Manual best'}</span>
          <span className="text-sm text-gray-500">{language === 'ja' ? 'AIが最良' : 'AI best'}</span>
        </div>
        <RatingScale name="overall_comparison" register={register} required error={errors.overall_comparison} />
      </div>

      <div>
        <QuestionLabel required>{t.returnToManual}</QuestionLabel>
        <RadioGroup
          name="return_to_manual"
          options={[
            { value: 'definitely_no', label: language === 'ja' ? '絶対に戻りたくない' : 'Definitely no' },
            { value: 'probably_no', label: language === 'ja' ? 'おそらく戻りたくない' : 'Probably no' },
            { value: 'neutral', label: language === 'ja' ? 'どちらでもない' : 'Neutral' },
            { value: 'probably_yes', label: language === 'ja' ? 'おそらく戻りたい' : 'Probably yes' },
            { value: 'definitely_yes', label: language === 'ja' ? '絶対に戻りたい' : 'Definitely yes' },
          ]}
          register={register}
          required
          error={errors.return_to_manual}
        />
      </div>

      <div>
        <QuestionLabel>{t.mostImpressive}</QuestionLabel>
        <TextArea name="most_impressive_ai_experience" register={register} rows={4} error={errors.most_impressive_ai_experience} />
      </div>

      <div>
        <QuestionLabel>{t.additionalComments}</QuestionLabel>
        <TextArea name="additional_comments" register={register} rows={5} error={errors.additional_comments} />
      </div>
    </div>
  );
};
