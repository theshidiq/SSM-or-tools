import React, { useMemo } from "react";
import { format, startOfWeek, isSameWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { shiftSymbols } from "../../constants/shiftConstants";

const StaffCardView = React.memo(
  ({ orderedStaffMembers, dateRange, schedule }) => {
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

          // Array to store all shift dates with types for chronological sorting
          const allShiftDates = [];

          // Process each date in the range
          dateRange.forEach((date) => {
            try {
              const dateKey = date.toISOString().split("T")[0];
              const shiftValue = staffSchedule[dateKey] || "";

              if (
                shiftValue === shiftSymbols.early.symbol ||
                shiftValue === "early"
              ) {
                earlyShifts++;
                allShiftDates.push({ date, type: "early", value: shiftValue });
              } else if (
                shiftValue === shiftSymbols.off.symbol ||
                shiftValue === "off"
              ) {
                daysOff++;
                allShiftDates.push({ date, type: "off", value: shiftValue });
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
                allShiftDates.push({ date, type: "custom", value: shiftValue });
              }
            } catch (error) {
              console.warn(`Error processing date ${date}:`, error);
            }
          });

          // Sort all shift dates chronologically
          allShiftDates.sort((a, b) => a.date - b.date);

          return {
            staff,
            stats: {
              earlyShifts,
              normalShifts,
              lateShifts,
              daysOff,
              customTextDays,
            },
            allShiftDates,
          };
        })
        .filter(Boolean); // Remove null entries from invalid staff
    }, [orderedStaffMembers, dateRange, schedule]);

    // Helper function to format date for display with day of week
    const formatDateForCard = (date) => {
      try {
        return format(date, "M/d(E)", { locale: ja });
      } catch (error) {
        console.warn("Error formatting date:", date, error);
        return "Invalid Date";
      }
    };

    // Helper function to group dates by week
    const groupDatesByWeek = (dates) => {
      const weeks = [];
      let currentWeek = [];
      let currentWeekStart = null;

      dates.forEach((item) => {
        const weekStart = startOfWeek(item.date, {
          weekStartsOn: 0,
          locale: ja,
        }); // Sunday start

        if (
          !currentWeekStart ||
          !isSameWeek(item.date, currentWeekStart, {
            weekStartsOn: 0,
            locale: ja,
          })
        ) {
          if (currentWeek.length > 0) {
            weeks.push({
              weekStart: currentWeekStart,
              dates: currentWeek,
            });
          }
          currentWeek = [item];
          currentWeekStart = weekStart;
        } else {
          currentWeek.push(item);
        }
      });

      // Add the last week
      if (currentWeek.length > 0) {
        weeks.push({
          weekStart: currentWeekStart,
          dates: currentWeek,
        });
      }

      return weeks;
    };

    // Helper function to get department color
    const getDepartmentColor = (department) => {
      const colors = {
        調理: "bg-blue-50 text-blue-700 border-blue-200",
        ホール: "bg-green-50 text-green-700 border-green-200",
        洗い場: "bg-purple-50 text-purple-700 border-purple-200",
        管理: "bg-orange-50 text-orange-700 border-orange-200",
      };
      return colors[department] || "bg-gray-50 text-gray-700 border-gray-200";
    };

    // Helper function to get status color
    const getStatusColor = (status) => {
      const colors = {
        社員: "bg-green-50 text-green-700 border-green-200",
        派遣: "bg-blue-50 text-blue-700 border-blue-200",
        パート: "bg-orange-50 text-orange-700 border-orange-200",
      };
      return colors[status] || "bg-gray-50 text-gray-700 border-gray-200";
    };

    if (!orderedStaffMembers || orderedStaffMembers.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-500">No staff data available</div>
        </div>
      );
    }

    return (
      <div className="staff-card-view w-4/5 mx-auto mb-8">
        {/* Card View Title */}
        <div className="bg-white border border-gray-200 rounded-t-lg px-6 py-4 border-b-0 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              調理場シフト表
            </h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-200 rounded border border-blue-300"></div>
                <span>早番(△)</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-red-200 rounded border border-red-300"></div>
                <span>休み(×)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getStaffShiftData.map(({ staff, stats, allShiftDates }) => (
            <div
              key={staff.id}
              className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-6"
            >
              {/* Header with Stats */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 mr-2">
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
                <div className="flex-shrink-0 text-right text-xs">
                  <span className="text-blue-600 font-medium">
                    {stats.earlyShifts}日
                  </span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-red-600 font-medium">
                    {stats.daysOff}日
                  </span>
                  <span className="text-gray-400 mx-1">|</span>
                  <span className="text-gray-600 font-medium">
                    {(() => {
                      const total =
                        stats.earlyShifts * 0.5 +
                        stats.daysOff * 1 +
                        stats.customTextDays * 1;
                      return total % 1 === 0
                        ? total.toString()
                        : total.toFixed(1);
                    })()}
                    日
                  </span>
                </div>
              </div>

              {/* Weekly Grouped Timeline */}
              {allShiftDates.length > 0 && (
                <div className="mb-3">
                  {groupDatesByWeek(allShiftDates).map((week, weekIndex) => {
                    // Calculate week statistics
                    const weekStats = week.dates.reduce(
                      (acc, item) => {
                        if (item.type === "early") acc.early++;
                        if (item.type === "off") acc.off++;
                        if (item.type === "custom") acc.custom++;
                        return acc;
                      },
                      { early: 0, off: 0, custom: 0 },
                    );

                    return (
                      <div key={`week-${weekIndex}`} className="mb-2">
                        {/* Week Dates */}
                        <div className="flex flex-wrap gap-1">
                          {week.dates.map((item, index) => {
                            const colorClasses = {
                              early: "text-blue-600 bg-blue-50",
                              off: "text-red-600 bg-red-50",
                              custom: "text-yellow-700 bg-yellow-50",
                            };

                            return (
                              <span
                                key={`shift-${item.date.toISOString().split("T")[0]}-${index}`}
                                className={`px-3 py-2 text-base font-medium rounded ${colorClasses[item.type] || "text-gray-600 bg-gray-50"}`}
                                title={
                                  item.type === "custom"
                                    ? `${formatDateForCard(item.date)}: ${item.value}`
                                    : undefined
                                }
                              >
                                {formatDateForCard(item.date)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
          ))}
        </div>
      </div>
    );
  },
);

export default StaffCardView;
