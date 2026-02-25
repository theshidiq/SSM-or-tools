import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  Area,
} from 'recharts';
import { supabase } from '../../utils/supabaseClient';

const ResultsDashboard = ({ language = 'ja' }) => {
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [timeComparison, setTimeComparison] = useState(null);
  const [violationComparison, setViolationComparison] = useState([]);
  const [businessImpact, setBusinessImpact] = useState(null);
  const [overallScore, setOverallScore] = useState(null);
  const [staffSatisfaction, setStaffSatisfaction] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const t = language === 'ja' ? {
    title: '調査結果・分析ダッシュボード',
    subtitle: '手動 vs OR-Tools 比較分析',
    totalResponses: '総回答数',
    completedResponses: '完了回答数',
    npsScore: 'NPSスコア',
    avgSatisfaction: '平均満足度',
    timeComparison: '時間効率比較',
    satisfactionByCategory: 'カテゴリー別満足度',
    errorReduction: 'エラー削減率',
    fairnessImprovement: '公平性向上',
    exportCsv: 'CSVエクスポート',
    refreshData: 'データ更新',
    manual: '手動',
    ai: 'OR-Tools',
    promoters: 'プロモーター',
    passives: 'パッシブ',
    detractors: 'デトラクター',
    comparisonTitle: '手動 vs OR-Tools 直接比較',
    fairness: '公平性',
    usability: '使いやすさ',
    violationComparison: '制約違反頻度比較',
    businessImpact: 'ビジネスインパクト',
    annualTimeSaved: '年間時間節約',
    recommendation: '推奨度',
    overallScore: '総合評価スコア',
    staffSatisfactionChange: 'スタッフ満足度変化',
    timeSavingsPercent: '時間削減率',
    minutes: '分',
    hours: '時間',
    violationFrequency: '違反頻度',
    almostAlways: 'ほぼ毎回',
    frequently: '頻繁',
    sometimes: '時々',
    rarely: 'まれに',
    never: '全くない',
    significantlyImproved: '大幅向上',
    improved: '向上',
    noChange: '変化なし',
    decreased: '低下',
  } : {
    title: 'Research Results & Analytics Dashboard',
    subtitle: 'Manual vs OR-Tools Comparison Analysis',
    totalResponses: 'Total Responses',
    completedResponses: 'Completed',
    npsScore: 'NPS Score',
    avgSatisfaction: 'Avg Satisfaction',
    timeComparison: 'Time Efficiency Comparison',
    satisfactionByCategory: 'Satisfaction by Category',
    errorReduction: 'Error Reduction',
    fairnessImprovement: 'Fairness Improvement',
    exportCsv: 'Export CSV',
    refreshData: 'Refresh Data',
    manual: 'Manual',
    ai: 'OR-Tools',
    promoters: 'Promoters',
    passives: 'Passives',
    detractors: 'Detractors',
    comparisonTitle: 'Manual vs OR-Tools Direct Comparison',
    fairness: 'Fairness',
    usability: 'Usability',
    violationComparison: 'Constraint Violation Frequency',
    businessImpact: 'Business Impact',
    annualTimeSaved: 'Annual Time Saved',
    recommendation: 'Recommendation',
    overallScore: 'Overall Score',
    staffSatisfactionChange: 'Staff Satisfaction Change',
    timeSavingsPercent: 'Time Savings',
    minutes: 'min',
    hours: 'hrs',
    violationFrequency: 'Violation Frequency',
    almostAlways: 'Almost Always',
    frequently: 'Frequently',
    sometimes: 'Sometimes',
    rarely: 'Rarely',
    never: 'Never',
    significantlyImproved: 'Significantly Improved',
    improved: 'Improved',
    noChange: 'No Change',
    decreased: 'Decreased',
  };

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('survey_responses_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'survey_responses' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all data in parallel
      const [
        analyticsRes,
        responsesRes,
        comparisonRes,
        timeComparisonRes,
        violationRes,
        businessRes,
        overallRes,
        staffSatRes,
      ] = await Promise.all([
        supabase.from('survey_analytics').select('*').single(),
        supabase.from('survey_responses').select('*').eq('completed', true).order('created_at', { ascending: false }),
        supabase.from('manual_vs_ai_comparison').select('*').single(),
        supabase.from('time_comparison_aggregated').select('*').single(),
        supabase.from('violation_comparison').select('*'),
        supabase.from('business_impact_metrics').select('*').single(),
        supabase.from('overall_comparison_score').select('*').single(),
        supabase.from('staff_satisfaction_change').select('*'),
      ]);

      setAnalytics(analyticsRes.data);
      setResponses(responsesRes.data || []);
      setComparison(comparisonRes.data);
      setTimeComparison(timeComparisonRes.data);
      setViolationComparison(violationRes.data || []);
      setBusinessImpact(businessRes.data);
      setOverallScore(overallRes.data);
      setStaffSatisfaction(staffSatRes.data || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = () => {
    if (responses.length === 0) return;

    const headers = Object.keys(responses[0]);
    const csvContent = [
      headers.join(','),
      ...responses.map(row => headers.map(header => JSON.stringify(row[header] || '')).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `survey_results_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const resetAllData = async () => {
    const confirmMessage = language === 'ja'
      ? '本当にすべての回答データを削除しますか？この操作は取り消せません。'
      : 'Are you sure you want to delete ALL survey responses? This cannot be undone.';

    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      // Delete all survey responses from database
      const { error } = await supabase
        .from('survey_responses')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) {
        console.error('Error deleting data:', error);
        alert(language === 'ja' ? 'データ削除に失敗しました' : 'Failed to delete data');
      } else {
        // Clear local state
        setAnalytics(null);
        setResponses([]);
        setComparison(null);
        setTimeComparison(null);
        setViolationComparison([]);
        setBusinessImpact(null);
        setOverallScore(null);
        setStaffSatisfaction([]);
        setLastUpdated(null);
        alert(language === 'ja' ? 'データを削除しました' : 'Data deleted successfully');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(language === 'ja' ? 'エラーが発生しました' : 'An error occurred');
    } finally {
      setLoading(false);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analytics || responses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">
          {language === 'ja' ? 'まだ回答がありません' : 'No responses yet'}
        </p>
        <button
          onClick={fetchData}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {t.refreshData}
        </button>
      </div>
    );
  }

  // Calculate time savings percentage
  const timeSavingsPercent = timeComparison
    ? Math.round((1 - (timeComparison.avg_ai_minutes / timeComparison.avg_manual_minutes)) * 100)
    : 0;

  // Prepare data for Time Comparison Chart (using real data)
  const timeComparisonData = timeComparison ? [
    {
      category: t.manual,
      avgTime: parseFloat(timeComparison.avg_manual_minutes) || 0,
      fill: '#ef4444',
    },
    {
      category: t.ai,
      avgTime: parseFloat(timeComparison.avg_ai_minutes) || 0,
      fill: '#22c55e',
    },
  ] : [];

  // Prepare data for Manual vs AI Direct Comparison (Radar Chart)
  const radarComparisonData = comparison ? [
    {
      metric: t.fairness,
      manual: parseFloat(comparison.avg_manual_fairness) || 0,
      ai: parseFloat(comparison.avg_ai_fairness) || 0,
      fullMark: 5,
    },
    {
      metric: t.usability,
      manual: parseFloat(comparison.avg_manual_usability) || 0,
      ai: parseFloat(comparison.avg_ai_usability) || 0,
      fullMark: 5,
    },
    {
      metric: language === 'ja' ? '信頼性' : 'Trust',
      manual: 3, // Manual baseline
      ai: parseFloat(comparison.avg_ai_trust) || 0,
      fullMark: 5,
    },
    {
      metric: language === 'ja' ? '精度' : 'Accuracy',
      manual: 3, // Manual baseline
      ai: parseFloat(comparison.avg_constraint_accuracy) || 0,
      fullMark: 5,
    },
    {
      metric: language === 'ja' ? '意思決定' : 'Decision',
      manual: 3, // Manual baseline
      ai: parseFloat(comparison.avg_decision_improvement) || 0,
      fullMark: 5,
    },
  ] : [];

  // Fairness/Usability side-by-side comparison
  const directComparisonData = comparison ? [
    {
      category: t.fairness,
      manual: parseFloat(comparison.avg_manual_fairness) || 0,
      ai: parseFloat(comparison.avg_ai_fairness) || 0,
    },
    {
      category: t.usability,
      manual: parseFloat(comparison.avg_manual_usability) || 0,
      ai: parseFloat(comparison.avg_ai_usability) || 0,
    },
  ] : [];

  // Violation frequency mapping
  const violationLabels = {
    'almost_always': { label: t.almostAlways, order: 1 },
    'frequently': { label: t.frequently, order: 2 },
    'sometimes': { label: t.sometimes, order: 3 },
    'rarely': { label: t.rarely, order: 4 },
    'never': { label: t.never, order: 5 },
  };

  // Prepare violation comparison data
  const violationChartData = violationComparison.map(v => ({
    manual: violationLabels[v.manual_violation_frequency]?.label || v.manual_violation_frequency,
    ai: violationLabels[v.ai_violation_frequency]?.label || v.ai_violation_frequency,
    count: v.response_count,
    satisfaction: parseFloat(v.avg_accuracy_satisfaction) || 0,
  }));

  // Staff satisfaction change data
  const satisfactionLabels = {
    'significantly_improved': { label: t.significantlyImproved, color: '#22c55e' },
    'improved': { label: t.improved, color: '#86efac' },
    'no_change': { label: t.noChange, color: '#fbbf24' },
    'decreased': { label: t.decreased, color: '#ef4444' },
  };

  const staffSatisfactionData = staffSatisfaction.map(s => ({
    name: satisfactionLabels[s.staff_satisfaction_change]?.label || s.staff_satisfaction_change,
    value: s.response_count,
    fill: satisfactionLabels[s.staff_satisfaction_change]?.color || '#94a3b8',
  }));

  // Overall score distribution
  const overallScoreData = overallScore ? [
    { score: '5 (OR-Tools Best)', count: overallScore.score_5_count || 0, fill: '#22c55e' },
    { score: '4', count: overallScore.score_4_count || 0, fill: '#86efac' },
    { score: '3 (Neutral)', count: overallScore.score_3_count || 0, fill: '#fbbf24' },
    { score: '2', count: overallScore.score_2_count || 0, fill: '#fb923c' },
    { score: '1 (Manual Best)', count: overallScore.score_1_count || 0, fill: '#ef4444' },
  ] : [];

  // Business Impact - Annual Time Saved
  const annualTimeSavedData = businessImpact ? [
    { range: '<10h', count: businessImpact.saved_under_10hr || 0, fill: '#94a3b8' },
    { range: '10-20h', count: businessImpact.saved_10_20hr || 0, fill: '#60a5fa' },
    { range: '20-40h', count: businessImpact.saved_20_40hr || 0, fill: '#3b82f6' },
    { range: '40-60h', count: businessImpact.saved_40_60hr || 0, fill: '#2563eb' },
    { range: '>60h', count: businessImpact.saved_over_60hr || 0, fill: '#1d4ed8' },
  ] : [];

  // Recommendation distribution
  const recommendationData = businessImpact ? [
    { name: language === 'ja' ? '強く推奨' : 'Highly Recommend', value: businessImpact.highly_recommend || 0, fill: '#22c55e' },
    { name: language === 'ja' ? '推奨' : 'Recommend', value: businessImpact.recommend || 0, fill: '#86efac' },
    { name: language === 'ja' ? '中立' : 'Neutral', value: businessImpact.neutral || 0, fill: '#fbbf24' },
    { name: language === 'ja' ? '非推奨' : 'Not Recommend', value: businessImpact.do_not_recommend || 0, fill: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
          {lastUpdated && (
            <p className="text-xs text-gray-400 mt-1">
              {language === 'ja' ? '最終更新: ' : 'Last updated: '}
              {lastUpdated.toLocaleString(language === 'ja' ? 'ja-JP' : 'en-US')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={resetAllData}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span>🗑️</span> {language === 'ja' ? 'データ削除' : 'Delete All'}
          </button>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span>🔄</span> {t.refreshData}
          </button>
          <button
            onClick={exportToCsv}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <span>📥</span> {t.exportCsv}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">{t.totalResponses}</div>
          <div className="text-3xl font-bold text-blue-600">{analytics.total_responses || 0}</div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">{t.completedResponses}</div>
          <div className="text-3xl font-bold text-green-600">{analytics.completed_responses || 0}</div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">{t.timeSavingsPercent}</div>
          <div className="text-3xl font-bold text-purple-600">{timeSavingsPercent}%</div>
          <div className="text-xs text-gray-400 mt-1">
            {timeComparison && `${timeComparison.avg_manual_minutes}${t.minutes} → ${timeComparison.avg_ai_minutes}${t.minutes}`}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="text-sm text-gray-500 mb-1">{t.overallScore}</div>
          <div className="text-3xl font-bold text-orange-600">
            {overallScore?.avg_overall_score || 0}/5
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {language === 'ja' ? 'OR-Tools優位度' : 'OR-Tools Preference'}
          </div>
        </div>
      </div>

      {/* Main Comparison Section */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
          📊 {t.comparisonTitle}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time Comparison Bar Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.timeComparison}</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" label={{ value: t.minutes, position: 'bottom' }} />
                <YAxis type="category" dataKey="category" width={80} />
                <Tooltip formatter={(value) => [`${value} ${t.minutes}`, '']} />
                <Bar dataKey="avgTime" radius={[0, 8, 8, 0]}>
                  {timeComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 text-center">
              <p className="text-lg font-bold text-green-600">
                ⚡ {timeSavingsPercent}% {language === 'ja' ? '時間削減' : 'Time Reduction'}
              </p>
              <p className="text-sm text-gray-500">
                {timeComparison && `${timeComparison.avg_manual_minutes} ${t.minutes} → ${timeComparison.avg_ai_minutes} ${t.minutes}`}
              </p>
            </div>
          </div>

          {/* Radar Comparison Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {language === 'ja' ? '多角的比較' : 'Multi-dimensional Comparison'}
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarComparisonData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis angle={30} domain={[0, 5]} />
                <Radar
                  name={t.manual}
                  dataKey="manual"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.3}
                />
                <Radar
                  name={t.ai}
                  dataKey="ai"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.3}
                />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Comparison Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fairness & Usability Side-by-Side */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            {language === 'ja' ? '公平性・使いやすさ比較' : 'Fairness & Usability Comparison'}
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={directComparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="manual" name={t.manual} fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ai" name={t.ai} fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {comparison && (
            <div className="mt-4 grid grid-cols-2 gap-4 text-center text-sm">
              <div>
                <span className="text-gray-500">{t.fairness}: </span>
                <span className="font-bold text-red-500">{comparison.avg_manual_fairness}</span>
                <span className="text-gray-400"> → </span>
                <span className="font-bold text-green-500">{comparison.avg_ai_fairness}</span>
              </div>
              <div>
                <span className="text-gray-500">{t.usability}: </span>
                <span className="font-bold text-red-500">{comparison.avg_manual_usability}</span>
                <span className="text-gray-400"> → </span>
                <span className="font-bold text-green-500">{comparison.avg_ai_usability}</span>
              </div>
            </div>
          )}
        </div>

        {/* Staff Satisfaction Change */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.staffSatisfactionChange}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={staffSatisfactionData}
                cx="50%"
                cy="50%"
                labelLine={true}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                dataKey="value"
              >
                {staffSatisfactionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Violation Comparison */}
      {violationChartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.violationComparison}</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t.manual} {t.violationFrequency}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {t.ai} {t.violationFrequency}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {language === 'ja' ? '回答数' : 'Responses'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    {language === 'ja' ? '精度満足度' : 'Accuracy Satisfaction'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {violationChartData.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                        {row.manual}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        {row.ai}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{row.satisfaction}/5</span>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${(row.satisfaction / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Business Impact Section */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">
          💼 {t.businessImpact}
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Annual Time Saved Distribution */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.annualTimeSaved}</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={annualTimeSavedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {annualTimeSavedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Recommendation Distribution */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.recommendation}</h4>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={recommendationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${value}`}
                >
                  {recommendationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Overall Score Distribution */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{t.overallScore}</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={overallScoreData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="score" width={120} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {overallScoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Key Metrics */}
        {businessImpact && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">ROI</div>
              <div className="text-2xl font-bold text-purple-600">{businessImpact.avg_roi}/5</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">{language === 'ja' ? '業務効率' : 'Efficiency'}</div>
              <div className="text-2xl font-bold text-blue-600">{businessImpact.avg_management_efficiency}/5</div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">{language === 'ja' ? '継続使用希望' : 'Continue Using'}</div>
              <div className="text-2xl font-bold text-green-600">
                {((businessImpact.continue_definitely + businessImpact.continue_probably) / businessImpact.total_responses * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 text-center">
              <div className="text-sm text-gray-500">{language === 'ja' ? '手動に戻らない' : 'Won\'t Return'}</div>
              <div className="text-2xl font-bold text-green-600">
                {((businessImpact.return_definitely_no + businessImpact.return_probably_no) / businessImpact.total_responses * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent Responses Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {language === 'ja' ? '最近の回答' : 'Recent Responses'}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'ja' ? '日時' : 'Date'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'ja' ? '役職' : 'Position'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'ja' ? '手動時間' : 'Manual Time'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'ja' ? 'AI時間' : 'AI Time'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {language === 'ja' ? '総合評価' : 'Overall'}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {responses.slice(0, 10).map((response) => (
                <tr key={response.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(response.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {response.position?.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                      {response.manual_time_category?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      {response.ai_time_category?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-lg font-bold text-gray-900">{response.overall_comparison}/5</span>
                      <div className="ml-2 flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={star <= response.overall_comparison ? 'text-yellow-400' : 'text-gray-300'}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ResultsDashboard;
