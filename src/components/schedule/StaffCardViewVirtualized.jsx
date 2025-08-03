import React, { useMemo, useCallback, useState, useEffect } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { shiftSymbols } from "../../constants/shiftConstants";

// Individual staff card component optimized for virtualization
const StaffCard = React.memo(({ staffData, formatDateForCard, getDepartmentColor, getStatusColor, cardWidth = 350 }) => {
  const { staff, stats, dates } = staffData;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4 m-2"
      style={{ width: cardWidth - 16, height: 'auto', minHeight: '280px' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 mb-2 truncate">
            {staff.name}
          </h3>
          <div className="flex flex-wrap gap-1">
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
      <div className="grid grid-cols-2 gap-2 mb-3">
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

      {/* Early Shift Dates - Limited for performance */}
      {dates.earlyDates.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-blue-700 mb-1">
            早番日:
          </div>
          <div className="flex flex-wrap gap-1">
            {dates.earlyDates.slice(0, 4).map((date, index) => (
              <span
                key={`early-${date.toISOString().split("T")[0]}-${index}`}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
              >
                {formatDateForCard(date)}
              </span>
            ))}
            {dates.earlyDates.length > 4 && (
              <span className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded">
                +{dates.earlyDates.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Days Off Dates - Limited for performance */}
      {dates.daysOffDates.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-red-700 mb-1">
            休み日:
          </div>
          <div className="flex flex-wrap gap-1">
            {dates.daysOffDates.slice(0, 4).map((date, index) => (
              <span
                key={`off-${date.toISOString().split("T")[0]}-${index}`}
                className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded"
              >
                {formatDateForCard(date)}
              </span>
            ))}
            {dates.daysOffDates.length > 4 && (
              <span className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded">
                +{dates.daysOffDates.length - 4}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="pt-2 border-t border-gray-100 mt-auto">
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

StaffCard.displayName = 'VirtualizedStaffCard';

// Grid cell component for react-window
const GridCell = React.memo(({ columnIndex, rowIndex, style, data }) => {
  const { 
    staffShiftData, 
    columnsPerRow, 
    formatDateForCard, 
    getDepartmentColor, 
    getStatusColor,
    cardWidth 
  } = data;
  
  const itemIndex = rowIndex * columnsPerRow + columnIndex;
  const staffData = staffShiftData[itemIndex];

  if (!staffData) {
    return <div style={style} />; // Empty cell
  }

  return (
    <div style={style}>
      <StaffCard
        staffData={staffData}
        formatDateForCard={formatDateForCard}
        getDepartmentColor={getDepartmentColor}
        getStatusColor={getStatusColor}
        cardWidth={cardWidth}
      />
    </div>
  );
});

GridCell.displayName = 'GridCell';

const StaffCardViewVirtualized = React.memo(
  ({ orderedStaffMembers, dateRange, schedule, threshold = 50 }) => {
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

    // Memoized date formatter
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

    // Calculate staff shift data with performance optimizations
    const getStaffShiftData = useMemo(() => {
      if (!Array.isArray(orderedStaffMembers)) {
        console.warn("orderedStaffMembers is not an array:", orderedStaffMembers);
        return [];
      }

      // Performance optimization: limit calculations for very large datasets
      const shouldOptimize = orderedStaffMembers.length > threshold;

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

          // Arrays to store dates - limit for performance
          const earlyDates = [];
          const daysOffDates = [];
          const customTextDates = [];
          
          const maxStoredDates = shouldOptimize ? 8 : 20; // Limit stored dates for large datasets

          // Process each date in the range
          dateRange.forEach((date, index) => {
            try {
              const dateKey = dateKeys[index];
              const shiftValue = staffSchedule[dateKey] || "";

              if (
                shiftValue === shiftSymbols.early.symbol ||
                shiftValue === "early"
              ) {
                earlyShifts++;
                if (earlyDates.length < maxStoredDates) {
                  earlyDates.push(date);
                }
              } else if (
                shiftValue === shiftSymbols.off.symbol ||
                shiftValue === "off"
              ) {
                daysOff++;
                if (daysOffDates.length < maxStoredDates) {
                  daysOffDates.push(date);
                }
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
                customTextDays++;
                if (customTextDates.length < maxStoredDates) {
                  customTextDates.push({ date, text: shiftValue });
                }
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
        .filter(Boolean);
    }, [orderedStaffMembers, dateRange, schedule, dateKeys, threshold]);

    // Calculate grid dimensions
    const gridConfig = useMemo(() => {
      if (!containerDimensions.width) {
        return { columnsPerRow: 1, rowCount: getStaffShiftData.length, cardWidth: 350 };
      }

      const cardWidth = 350;
      const minCardWidth = 300;
      const maxCardWidth = 400;
      const padding = 32;
      
      const availableWidth = containerDimensions.width - padding;
      let columnsPerRow = Math.floor(availableWidth / cardWidth);
      
      // Ensure at least 1 column
      columnsPerRow = Math.max(1, columnsPerRow);
      
      // Adjust card width to fit better
      const adjustedCardWidth = Math.min(
        maxCardWidth, 
        Math.max(minCardWidth, availableWidth / columnsPerRow)
      );

      const rowCount = Math.ceil(getStaffShiftData.length / columnsPerRow);

      return {
        columnsPerRow,
        rowCount,
        cardWidth: adjustedCardWidth
      };
    }, [containerDimensions.width, getStaffShiftData.length]);

    // Grid item data for react-window
    const itemData = useMemo(() => ({
      staffShiftData: getStaffShiftData,
      columnsPerRow: gridConfig.columnsPerRow,
      formatDateForCard,
      getDepartmentColor,
      getStatusColor,
      cardWidth: gridConfig.cardWidth
    }), [
      getStaffShiftData, 
      gridConfig.columnsPerRow, 
      gridConfig.cardWidth,
      formatDateForCard, 
      getDepartmentColor, 
      getStatusColor
    ]);

    if (!orderedStaffMembers || orderedStaffMembers.length === 0) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-500">No staff data available</div>
        </div>
      );
    }

    // Use regular rendering for small datasets
    if (orderedStaffMembers.length <= threshold) {
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
                cardWidth={350}
              />
            ))}
          </div>
        </div>
      );
    }

    // Use virtualization for large datasets
    return (
      <div className="staff-card-view w-4/5 mx-auto mb-8">
        <div className="text-sm text-gray-500 mb-4">
          Displaying {getStaffShiftData.length} staff members (virtualized for performance)
        </div>
        <div style={{ height: '70vh', width: '100%' }}>
          <AutoSizer>
            {({ height, width }) => {
              // Update container dimensions
              if (width !== containerDimensions.width || height !== containerDimensions.height) {
                setTimeout(() => setContainerDimensions({ width, height }), 0);
              }

              return (
                <Grid
                  columnCount={gridConfig.columnsPerRow}
                  columnWidth={gridConfig.cardWidth}
                  height={height}
                  rowCount={gridConfig.rowCount}
                  rowHeight={320} // Fixed height for cards
                  width={width}
                  itemData={itemData}
                  overscanRowCount={2}
                  overscanColumnCount={1}
                >
                  {GridCell}
                </Grid>
              );
            }}
          </AutoSizer>
        </div>
      </div>
    );
  },
);

StaffCardViewVirtualized.displayName = 'StaffCardViewVirtualized';

export default StaffCardViewVirtualized;