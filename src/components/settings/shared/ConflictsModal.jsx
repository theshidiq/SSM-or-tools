import React, { useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X, AlertTriangle, Calendar, Users, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

/**
 * ConflictsModal Component
 *
 * Displays validation conflicts and violations from settings changes
 * Shows detailed information about:
 * - Staff group conflicts (members working same shift on same day)
 * - Daily limit violations (shift counts exceeding configured limits)
 *
 * Props:
 * @param {boolean} isOpen - Whether modal is visible
 * @param {Function} onClose - Close handler
 * @param {Array} conflicts - List of conflicts/violations to display
 * @param {string} type - Type of conflicts ('staff_groups' or 'daily_limits')
 * @param {Array} staffMembers - Staff members for name lookup
 * @param {string} title - Modal title
 */
const ConflictsModal = ({
  isOpen,
  onClose,
  conflicts = [],
  type = 'staff_groups',
  staffMembers = [],
  title = 'Schedule Conflicts'
}) => {
  // Helper: Get staff name by ID
  const getStaffName = useCallback((staffId) => {
    const staff = staffMembers.find(s => s.id === staffId);
    return staff?.name || 'Unknown Staff';
  }, [staffMembers]);

  // Helper: Format date for display
  const formatDate = useCallback((dateKey) => {
    try {
      const date = parseISO(dateKey);
      return format(date, 'M月d日 (E)', { locale: ja });
    } catch (error) {
      return dateKey;
    }
  }, []);

  // Group conflicts by date for better organization
  const groupedConflicts = useMemo(() => {
    const grouped = {};

    conflicts.forEach(conflict => {
      const dateKey = conflict.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(conflict);
    });

    return grouped;
  }, [conflicts]);

  // Sort dates chronologically
  const sortedDates = useMemo(() => {
    return Object.keys(groupedConflicts).sort((a, b) => {
      return new Date(a) - new Date(b);
    });
  }, [groupedConflicts]);

  if (!isOpen) return null;

  // Render staff group conflict details
  const renderStaffGroupConflict = (conflict) => {
    const { groupName, members, shifts } = conflict;

    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Users size={20} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-red-900 mb-2">
              Group: {groupName}
            </h4>
            <p className="text-sm text-red-800 mb-3">
              Multiple group members are scheduled to work on the same day, violating intra-group conflict rules.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-900">Working Members:</p>
              <div className="grid grid-cols-1 gap-2">
                {shifts?.map((shiftInfo, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-white rounded px-3 py-2"
                  >
                    <span className="font-medium text-gray-900">
                      {getStaffName(shiftInfo.staffId)}
                    </span>
                    <span className="text-gray-500">→</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      {shiftInfo.shift === '△' ? '早番' : shiftInfo.shift === '○' ? '通常勤務' : shiftInfo.shift}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render daily limit violation details
  const renderDailyLimitViolation = (violation) => {
    const {
      limitName,
      shiftType,
      maxCount,
      actualCount,
      violatingStaff,
      dayOfWeek
    } = violation;

    const shiftTypeLabel = shiftType === '△' ? '早番' :
                          shiftType === '○' ? '通常勤務' :
                          shiftType === 'early' ? '早番' :
                          shiftType === 'late' ? '通常勤務' :
                          'Any';

    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <TrendingUp size={20} className="text-orange-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-orange-900 mb-2">
              {limitName}
            </h4>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-orange-800">Shift Type:</span>
                  <span className="font-medium text-orange-900">{shiftTypeLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-800">Day:</span>
                  <span className="font-medium text-orange-900">{dayOfWeek}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-orange-800">Limit:</span>
                <span className="font-medium text-orange-900">{maxCount} shifts</span>
                <span className="text-orange-500">→</span>
                <span className="font-medium text-red-600">Actual: {actualCount} shifts</span>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                  +{actualCount - maxCount} over limit
                </span>
              </div>
            </div>
            {violatingStaff && violatingStaff.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-orange-900">
                  Affected Staff ({violatingStaff.length}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {violatingStaff.map((staffId, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white text-orange-900 rounded text-sm border border-orange-200"
                    >
                      {getStaffName(staffId)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Use React Portal to render outside parent DOM hierarchy and bypass stacking context
  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl relative z-[70001]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected in current schedule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {conflicts.length === 0 ? (
            <div className="text-center py-12">
              <Calendar size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">No conflicts found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedDates.map(dateKey => (
                <div key={dateKey} className="space-y-3">
                  {/* Date Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                    <Calendar size={18} className="text-gray-600" />
                    <h4 className="font-semibold text-gray-900">
                      {formatDate(dateKey)}
                    </h4>
                    <span className="text-sm text-gray-500">
                      ({groupedConflicts[dateKey].length} conflict{groupedConflicts[dateKey].length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {/* Conflicts for this date */}
                  <div className="space-y-3">
                    {groupedConflicts[dateKey].map((conflict, idx) => (
                      <div key={idx}>
                        {type === 'staff_groups' && renderStaffGroupConflict(conflict)}
                        {type === 'daily_limits' && renderDailyLimitViolation(conflict)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {type === 'staff_groups' && (
              <p>
                💡 Tip: Review group memberships or adjust the schedule to resolve conflicts.
              </p>
            )}
            {type === 'daily_limits' && (
              <p>
                💡 Tip: Increase the limits or adjust the schedule to comply with new settings.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConflictsModal;
