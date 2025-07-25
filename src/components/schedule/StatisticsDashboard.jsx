import React from 'react';
import { BarChart3, FileText } from 'lucide-react';
import { getOrderedStaffMembers } from '../../utils/staffUtils';
import { calculateWorkloadPercentage } from '../../utils/statisticsUtils';

const StatisticsDashboard = ({ statistics, staffMembers, dateRange }) => {
  const orderedStaffMembers = getOrderedStaffMembers(staffMembers, dateRange);

  return (
    <div className="statistics-section w-4/5 mx-auto">
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-lg border border-gray-200 shadow-sm mb-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <BarChart3 size={24} />
          統計・分析 (Statistics & Analytics)
        </h2>
        
        {/* Staff Work Patterns Table */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText size={20} />
            スタッフ別勤務パターン詳細 (Detailed Staff Work Patterns)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-700">スタッフ (Staff)</th>
                  <th className="text-center p-3 font-medium text-gray-600">○ Normal</th>
                  <th className="text-center p-3 font-medium text-blue-600">△ Early</th>
                  <th className="text-center p-3 font-medium text-red-600">× Off</th>
                  <th className="text-center p-3 font-medium text-yellow-600">★ Holiday</th>
                  <th className="text-center p-3 font-medium text-green-600">Total</th>
                  <th className="text-center p-3 font-medium text-purple-600">Workload</th>
                </tr>
              </thead>
              <tbody>
                {orderedStaffMembers.map(staff => {
                  const staffStats = statistics.staffStats[staff.id];
                  const workloadPercentage = calculateWorkloadPercentage(staffStats, dateRange.length);
                  
                  // Calculate total: triangle=0.5, cross=1, stars=1
                  const total = ((staffStats?.early || 0) * 0.5) + 
                               ((staffStats?.off || 0) * 1) + 
                               ((staffStats?.holiday || 0) * 1);
                  
                  return (
                    <tr key={staff.id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{staffStats?.name || staff.name}</td>
                      <td className="p-3 text-center text-gray-600 font-medium">{staffStats?.normal || 0}</td>
                      <td className="p-3 text-center text-blue-600 font-medium">{staffStats?.early || 0}</td>
                      <td className="p-3 text-center text-red-600 font-medium">{staffStats?.off || 0}</td>
                      <td className="p-3 text-center text-yellow-600 font-medium">{staffStats?.holiday || 0}</td>
                      <td className="p-3 text-center text-green-600 font-medium">{total}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center">
                          <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                            {workloadPercentage}%
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsDashboard;