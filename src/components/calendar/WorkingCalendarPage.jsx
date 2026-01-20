import React, { useState, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, Flag } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, getDay, isSameMonth, isToday } from "date-fns";
import { ja } from "date-fns/locale";
import { useCalendarRules } from "../../hooks/useCalendarRules";
import { useRestaurant } from "../../contexts/RestaurantContext";
import { useJapaneseHolidays } from "../../hooks/useJapaneseHolidays";

const WorkingCalendarPage = () => {
  console.log('🟢 [CALENDAR] WorkingCalendarPage is rendering');

  const { restaurant } = useRestaurant();
  console.log('🔍 [CALENDAR] restaurant context:', restaurant);
  console.log('🔍 [CALENDAR] restaurant?.id:', restaurant?.id);
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0); // 0 = current month
  const [showLoader, setShowLoader] = useState(false); // Delayed loading indicator

  // Calculate the 3 months to display
  const months = useMemo(() => {
    const base = new Date();
    return [
      addMonths(base, currentMonthOffset),
      addMonths(base, currentMonthOffset + 1),
      addMonths(base, currentMonthOffset + 2),
    ];
  }, [currentMonthOffset]);

  // Calculate date range for loading rules
  const dateRange = useMemo(() => {
    if (months.length === 0) return { start: null, end: null };
    return {
      start: startOfMonth(months[0]),
      end: endOfMonth(months[months.length - 1]),
    };
  }, [months]);

  // Load calendar rules
  const { rules, isLoading, error, toggleRule } = useCalendarRules(
    restaurant?.id,
    dateRange.start,
    dateRange.end
  );

  // Load Japanese holidays
  const { holidays: japaneseHolidays, isLoading: isLoadingHolidays, error: holidaysError } = useJapaneseHolidays(
    dateRange.start,
    dateRange.end
  );

  console.log('🔍 [CALENDAR] useCalendarRules result:', {
    rules,
    isLoading,
    error,
    rulesCount: Object.keys(rules || {}).length
  });

  // Delayed loading indicator - only show loader if loading takes more than 300ms
  useEffect(() => {
    let timeoutId;

    if (isLoading) {
      // Start a timer - show loader only if still loading after 300ms
      timeoutId = setTimeout(() => {
        setShowLoader(true);
      }, 300);
    } else {
      // Loading finished - hide loader immediately
      setShowLoader(false);
    }

    return () => {
      // Cleanup timeout on unmount or when isLoading changes
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isLoading]);

  // Navigation handlers - Navigate by 1 month at a time
  const handlePrevious = () => {
    setCurrentMonthOffset((prev) => prev - 1);
  };

  const handleNext = () => {
    setCurrentMonthOffset((prev) => prev + 1);
  };

  // Keyboard navigation - Arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle arrow keys when not typing in an input/textarea
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle cell click - toggle rule
  const handleDateClick = async (date) => {
    // Prevent operations if restaurant context is not ready
    if (!restaurant?.id) {
      console.error("❌ [WorkingCalendarPage] Cannot toggle rule: Restaurant context not initialized");
      return;
    }

    try {
      await toggleRule(date);
    } catch (err) {
      console.error("❌ [WorkingCalendarPage] Failed to toggle rule:", err);
      // Error already set in hook's error state
    }
  };

  // Get cell style based on rule type and if it's today
  const getCellStyle = (date, ruleType) => {
    const isTodayDate = isToday(date);

    // Today's date - Gray background with white text (highest priority)
    if (isTodayDate && !ruleType) {
      return "bg-gray-700 hover:bg-gray-800 text-white border-gray-800";
    }

    if (isTodayDate && ruleType === "must_work") {
      return "bg-orange-500 hover:bg-orange-600 text-white border-orange-600";
    }

    if (isTodayDate && ruleType === "must_day_off") {
      return "bg-red-600 hover:bg-red-700 text-white font-bold border-red-700";
    }

    // Regular cells
    if (!ruleType) {
      // Normal - no rule
      return "bg-white hover:bg-gray-50 text-gray-900 border-gray-200";
    }

    if (ruleType === "must_work") {
      // Must Work - Orange background
      return "bg-orange-500 hover:bg-orange-600 text-white border-orange-600";
    }

    if (ruleType === "must_day_off") {
      // Must Day Off - Red background with white bold text
      return "bg-red-600 hover:bg-red-700 text-white font-bold border-red-700";
    }

    return "bg-white hover:bg-gray-50 text-gray-900 border-gray-200";
  };

  // Get symbol for rule type
  const getRuleSymbol = (ruleType) => {
    if (ruleType === "must_work") return "⚠️";
    if (ruleType === "must_day_off") return "×";
    return "";
  };

  // Render a single month calendar (compact version)
  const renderMonth = (month) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get starting day of week (0 = Sunday, 6 = Saturday)
    const startDay = getDay(monthStart);

    // Create array with empty cells for days before month start
    const calendarDays = [...Array(startDay).fill(null), ...days];

    return (
      <div key={month.toISOString()} className="flex-1 min-w-0">
        {/* Month Header - Compact */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-2 rounded-t">
          <h3 className="text-base font-bold text-center">
            {format(month, "yyyy年 M月", { locale: ja })}
          </h3>
        </div>

        {/* Day of Week Headers - Compact */}
        <div className="grid grid-cols-7 gap-0.5 bg-gray-100 p-1">
          {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
            <div
              key={day}
              className={`text-center text-xs font-semibold py-1 ${
                index === 0 ? "text-red-600" : index === 6 ? "text-blue-600" : "text-gray-700"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid - Larger cells */}
        <div className="grid grid-cols-7 gap-1 p-2 bg-gray-50 rounded-b">
          {calendarDays.map((day, index) => {
            if (!day) {
              // Empty cell before month starts
              return <div key={`empty-${index}`} className="h-14" />;
            }

            const dateString = format(day, "yyyy-MM-dd");
            const ruleType = rules[dateString];
            const isCurrentMonth = isSameMonth(day, month);

            return (
              <button
                key={dateString}
                onClick={() => handleDateClick(day)}
                className={`
                  h-14 w-full border rounded
                  transition-colors duration-150 ease-in-out
                  flex flex-col items-center justify-center
                  text-sm
                  ${getCellStyle(day, ruleType)}
                  ${!isCurrentMonth ? "opacity-40" : ""}
                `}
                title={ruleType ? `${ruleType === "must_work" ? "出勤必須" : "休日必須"} - ${dateString}` : dateString}
              >
                <span className="font-semibold">{format(day, "d")}</span>
                {ruleType && (
                  <span className="text-base">{getRuleSymbol(ruleType)}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Loading state
  if (!restaurant) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">レストラン情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header - Similar to NavigationToolbar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">カレンダールール</h1>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            前月
          </button>

          <div className="text-sm text-gray-700 font-medium">
            {format(months[0], "yyyy年M月", { locale: ja })} - {format(months[2], "yyyy年M月", { locale: ja })}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors shadow-sm"
          >
            次月
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            エラー: {error}
          </div>
        )}
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
        {/* Calendar Grid - 3 Months Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4 relative">
          {/* Delayed Skeleton Loader Overlay - only shows if loading > 300ms */}
          {showLoader && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 rounded-lg flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-600 font-medium">読み込み中...</p>
              </div>
            </div>
          )}

          {months.map(renderMonth)}
        </div>

        {/* Legend */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">凡例</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Today */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-700 border border-gray-800 rounded flex items-center justify-center">
                <span className="text-xs font-semibold text-white">{format(new Date(), "d")}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">今日</p>
                <p className="text-xs text-gray-600">現在の日付</p>
              </div>
            </div>

            {/* Normal */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white border border-gray-200 rounded flex items-center justify-center">
                <span className="text-xs font-semibold">15</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">通常</p>
                <p className="text-xs text-gray-600">ルールなし</p>
              </div>
            </div>

            {/* Must Work */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 border border-orange-600 rounded flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="text-xs font-semibold leading-none">30</div>
                  <div className="text-xs">⚠️</div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">出勤必須 (⚠️)</p>
                <p className="text-xs text-gray-600">イベント・休日禁止</p>
              </div>
            </div>

            {/* Must Day Off */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-600 border border-red-700 rounded flex items-center justify-center text-white">
                <div className="text-center">
                  <div className="text-xs font-bold leading-none">1</div>
                  <div className="text-xs font-bold">×</div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-900">休日必須 (×)</p>
                <p className="text-xs text-gray-600">メンテナンス・全員休み</p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
            <p className="text-xs text-gray-600 flex items-center gap-2">
              <Info className="w-3 h-3" />
              <span>日付をクリックして切り替え: 通常 → 出勤必須 → 休日必須 → 通常</span>
            </p>
            <p className="text-xs text-gray-600 flex items-center gap-2">
              <Info className="w-3 h-3" />
              <span>キーボード: ← → で月を移動</span>
            </p>
          </div>
        </div>

        {/* Japanese Holidays Section */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-gray-900">日本の祝日</h3>
            {isLoadingHolidays && (
              <span className="text-xs text-gray-500 ml-2">読み込み中...</span>
            )}
          </div>

          {holidaysError && (
            <div className="text-xs text-red-600 mb-2">
              祝日の取得に失敗しました: {holidaysError}
            </div>
          )}

          {/* Holidays Calendar Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {months.map((month) => {
              const monthStart = startOfMonth(month);
              const monthEnd = endOfMonth(month);
              const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
              const startDay = getDay(monthStart);
              const calendarDays = [...Array(startDay).fill(null), ...days];

              // Get holidays for this month
              const monthHolidays = Object.entries(japaneseHolidays).filter(([date]) => {
                const holidayDate = new Date(date);
                return holidayDate >= monthStart && holidayDate <= monthEnd;
              });

              return (
                <div key={month.toISOString()} className="flex-1 min-w-0">
                  {/* Month Header - Red theme for holidays */}
                  <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-2 rounded-t">
                    <h4 className="text-base font-bold text-center">
                      {format(month, "yyyy年 M月", { locale: ja })}
                      {monthHolidays.length > 0 && (
                        <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded">
                          {monthHolidays.length}件
                        </span>
                      )}
                    </h4>
                  </div>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-0.5 bg-gray-100 p-1">
                    {["日", "月", "火", "水", "木", "金", "土"].map((day, index) => (
                      <div
                        key={day}
                        className={`text-center text-xs font-semibold py-1 ${
                          index === 0 ? "text-red-600" : index === 6 ? "text-blue-600" : "text-gray-700"
                        }`}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 p-2 bg-gray-50 rounded-b">
                    {calendarDays.map((day, index) => {
                      if (!day) {
                        return <div key={`empty-${index}`} className="h-12" />;
                      }

                      const dateString = format(day, "yyyy-MM-dd");
                      const holidayName = japaneseHolidays[dateString];
                      const isHoliday = !!holidayName;
                      const isCurrentMonth = isSameMonth(day, month);
                      const isTodayDate = isToday(day);

                      return (
                        <div
                          key={dateString}
                          className={`
                            h-12 w-full border rounded
                            flex flex-col items-center justify-center
                            text-xs relative
                            ${isHoliday
                              ? "bg-red-600 text-white border-red-700 font-bold"
                              : isTodayDate
                              ? "bg-gray-700 text-white border-gray-800"
                              : "bg-white text-gray-900 border-gray-200"
                            }
                            ${!isCurrentMonth ? "opacity-40" : ""}
                          `}
                          title={isHoliday ? `${holidayName} - ${dateString}` : dateString}
                        >
                          <span className="font-semibold">{format(day, "d")}</span>
                          {isHoliday && (
                            <span className="text-[8px] leading-tight text-center truncate w-full px-0.5">
                              {holidayName}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Holidays List */}
          {Object.keys(japaneseHolidays).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-2">
                期間内の祝日一覧 ({Object.keys(japaneseHolidays).length}件)
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(japaneseHolidays)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, name]) => (
                    <div
                      key={date}
                      className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs flex items-center gap-1"
                    >
                      <span className="font-semibold">{format(new Date(date), "M/d", { locale: ja })}</span>
                      <span>{name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Holiday Legend */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 flex items-center gap-2">
              <Flag className="w-3 h-3 text-red-600" />
              <span>赤いセルは日本の祝日です。パート従業員は祝日に勤務できません。</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingCalendarPage;
