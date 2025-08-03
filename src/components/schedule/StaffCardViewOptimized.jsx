import React, { useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { shiftSymbols } from "../../constants/shiftConstants";

// Individual staff card component for better performance isolation
const StaffCard = React.memo(({ staffData, formatDateForCard, getDepartmentColor, getStatusColor }) => {
  const { staff, stats, dates } = staffData;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {staff.name}
          </h3>
          <div className="flex flex-wrap gap-2">
            {staff.department && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full border ${getDepartmentColor(staff.department)}`}
              >
                {staff.department}
              </span>
            )}
            {staff.status && (
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(staff.status)}`}
              >
                {staff.status}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="text-center p-2 bg-blue-50 rounded-lg">
          <div className="text-lg font-bold text-blue-600">
            {stats.earlyShifts}
          </div>
          <div className="text-xs text-blue-700">早番</div>
        </div>
        <div className="text-center p-2 bg-red-50 rounded-lg">
          <div className="text-lg font-bold text-red-600">
            {stats.daysOff}
          </div>
          <div className="text-xs text-red-700">休み</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded-lg">
          <div className="text-lg font-bold text-gray-600">
            {stats.normalShifts}
          </div>
          <div className="text-xs text-gray-700">通常</div>
        </div>
        <div className="text-center p-2 bg-yellow-50 rounded-lg">
          <div className="text-lg font-bold text-yellow-600">
            {stats.customTextDays}
          </div>
          <div className="text-xs text-yellow-700">その他</div>
        </div>
      </div>

      {/* Early Shift Dates */}
      {dates.earlyDates.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-blue-700 mb-1">
            早番日:
          </div>
          <div className="flex flex-wrap gap-1">
            {dates.earlyDates.slice(0, 8).map((date, index) => (
              <span
                key={`early-${date.toISOString().split("T")[0]}-${index}`}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {formatDateForCard(date)}
              </span>
            ))}
            {dates.earlyDates.length > 8 && (
              <span className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded">
                +{dates.earlyDates.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Days Off Dates */}
      {dates.daysOffDates.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-red-700 mb-1">
            休み日:
          </div>
          <div className="flex flex-wrap gap-1">
            {dates.daysOffDates.slice(0, 8).map((date, index) => (
              <span
                key={`off-${date.toISOString().split("T")[0]}-${index}`}
                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded"
              >
                {formatDateForCard(date)}
              </span>
            ))}
            {dates.daysOffDates.length > 8 && (
              <span className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded">
                +{dates.daysOffDates.length - 8}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Custom Text Dates */}
      {dates.customTextDates.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-yellow-700 mb-1">
            特別:
          </div>
          <div className="flex flex-wrap gap-1">
            {dates.customTextDates.slice(0, 6).map((item, index) => (
              <span
                key={`custom-${item.date.toISOString().split("T")[0]}-${index}`}
                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded"
                title={`${formatDateForCard(item.date)}: ${item.text}`}
              >
                {formatDateForCard(item.date)}
              </span>
            ))}
            {dates.customTextDates.length > 6 && (
              <span className="px-2 py-1 text-xs bg-yellow-50 text-yellow-600 rounded">
                +{dates.customTextDates.length - 6}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="pt-3 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          総勤務日:{" "}
          {stats.earlyShifts +
            stats.normalShifts +
            stats.lateShifts +
            stats.customTextDays}
          日
          {stats.lateShifts > 0 && (
            <span className="ml-2 text-purple-600">
              遅番: {stats.lateShifts}日
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

StaffCard.displayName = 'StaffCard';

const StaffCardView = React.memo(
  ({ orderedStaffMembers, dateRange, schedule }) => {
    // Memoized date formatter to avoid recreating on every render
    const formatDateForCard = useCallback((date) => {
      try {
        return format(date, "M/d", { locale: ja });
      } catch (error) {
        console.warn("Error formatting date:", date, error);
        return "Invalid Date";
      }
    }, []);

    // Memoized color functions
    const getDepartmentColor = useCallback((department) => {
      const colors = {
        調理: "bg-blue-50 text-blue-700 border-blue-200",
        ホール: "bg-green-50 text-green-700 border-green-200",
        洗い場: "bg-purple-50 text-purple-700 border-purple-200",
        管理: "bg-orange-50 text-orange-700 border-orange-200",
      };
      return colors[department] || "bg-gray-50 text-gray-700 border-gray-200";
    }, []);

    const getStatusColor = useCallback((status) => {
      const colors = {
        社員: "bg-red-50 text-red-700 border-red-200",
        派遣: "bg-blue-50 text-blue-700 border-blue-200",
        パート: "bg-green-50 text-green-700 border-green-200",
      };
      return colors[status] || "bg-gray-50 text-gray-700 border-gray-200";
    }, []);

    // Pre-computed date keys for better performance
    const dateKeys = useMemo(() => {
      return dateRange.map(date => date.toISOString().split("T")[0]);
    }, [dateRange]);

    // Helper function to calculate statistics and shift data for each staff member
    const getStaffShiftData = useMemo(() => {
      if (!Array.isArray(orderedStaffMembers)) {
        console.warn(
          "orderedStaffMembers is not an array:",
          orderedStaffMembers,
        );
        return [];
      }

      return orderedStaffMembers
        .map((staff) => {
          if (!staff || !staff.id) {
            console.warn("Invalid staff member:", staff);
            return null;
          }

          const staffSchedule = schedule[staff.id] || {};

          // Initialize counters
          let earlyShifts = 0;
          let normalShifts = 0;
          let lateShifts = 0;
          let daysOff = 0;
          let customTextDays = 0;

          // Arrays to store dates for each category
          const earlyDates = [];
          const daysOffDates = [];
          const customTextDates = [];

          // Process each date in the range using pre-computed keys
          dateRange.forEach((date, index) => {
            try {
              const dateKey = dateKeys[index];
              const shiftValue = staffSchedule[dateKey] || "";

              if (
                shiftValue === shiftSymbols.early.symbol ||
                shiftValue === "early"
              ) {
                earlyShifts++;
                earlyDates.push(date);
              } else if (
                shiftValue === shiftSymbols.off.symbol ||
                shiftValue === "off"
              ) {
                daysOff++;
                daysOffDates.push(date);
              } else if (
                shiftValue === shiftSymbols.late.symbol ||
                shiftValue === "late" ||
                shiftValue === "▽"
              ) {
                lateShifts++;
              } else if (
                shiftValue === "" ||
                shiftValue === "normal" ||
                shiftValue === shiftSymbols.normal.symbol
              ) {
                normalShifts++;
              } else if (shiftValue && shiftValue.trim() !== "") {
                // Custom text (any non-empty, non-standard shift value)
                customTextDays++;
                customTextDates.push({ date, text: shiftValue });
              }
            } catch (error) {
              console.warn(`Error processing date ${date}:`, error);
            }
          });

          return {
            staff,
            stats: {
              earlyShifts,
              normalShifts,
              lateShifts,
              daysOff,
              customTextDays,
            },
            dates: {
              earlyDates,
              daysOffDates,
              customTextDates,
            },
          };
        })
        .filter(Boolean); // Remove null entries from invalid staff
    }, [orderedStaffMembers, dateRange, schedule, dateKeys]);

    if (!orderedStaffMembers || orderedStaffMembers.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-500">No staff data available</div>
        </div>
      );
    }

    return (
      <div className="staff-card-view w-4/5 mx-auto mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getStaffShiftData.map((staffData) => (
            <StaffCard
              key={staffData.staff.id}
              staffData={staffData}
              formatDateForCard={formatDateForCard}
              getDepartmentColor={getDepartmentColor}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>
      </div>
    );
  },
);

StaffCardView.displayName = 'StaffCardView';

export default StaffCardView;