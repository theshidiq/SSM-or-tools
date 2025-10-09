import React from "react";
import ContentLoader from "react-content-loader";
import { Card } from "../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

/**
 * ScheduleTableSkeleton - Skeleton loader for the shift schedule table
 *
 * Features:
 * - Matches actual table structure (header, body, footer)
 * - Responsive design with configurable dimensions
 * - Uses react-content-loader for smooth animations
 * - Supports Japanese restaurant context styling
 * - Accessibility-friendly with proper ARIA labels
 */
const ScheduleTableSkeleton = ({
  staffCount = 5, // Default number of staff columns
  dateCount = 31, // Default number of date rows (approx 1 month)
  showConnectionStatus = false, // Show offline/pending status bar
}) => {
  // Calculate table dimensions
  const tableWidth = Math.max(300, 40 + staffCount * 40); // Min 300px, 40px per staff + 40px date column
  const cellHeight = 50;
  const headerHeight = 60;
  const footerHeight = 40;

  // Generate staff column skeletons
  const renderStaffHeaders = () => {
    return Array.from({ length: staffCount }).map((_, index) => (
      <TableHead
        key={`skeleton-header-${index}`}
        className="bg-primary text-primary-foreground text-center border-r border-border"
        style={{
          minWidth: "40px",
          width: "40px",
          maxWidth: "40px",
        }}
      >
        <div className="flex flex-col items-center justify-center py-1 px-1 h-full">
          <ContentLoader
            speed={2}
            width={30}
            height={40}
            viewBox="0 0 30 40"
            backgroundColor="#e5e7eb"
            foregroundColor="#f3f4f6"
            className="opacity-50"
          >
            {/* Staff name placeholder */}
            <rect x="2" y="8" rx="2" ry="2" width="26" height="8" />
            <rect x="6" y="20" rx="2" ry="2" width="18" height="6" />
            <rect x="8" y="30" rx="2" ry="2" width="14" height="4" />
          </ContentLoader>
        </div>
      </TableHead>
    ));
  };

  // Generate date row skeletons
  const renderDateRows = () => {
    return Array.from({ length: Math.min(dateCount, 20) }).map(
      (_, dateIndex) => (
        <TableRow
          key={`skeleton-row-${dateIndex}`}
          className="hover:bg-muted/50"
        >
          {/* Date Cell (Sticky Left Column) */}
          <TableCell
            className="text-center font-medium border-r-2 border-border sticky left-0 bg-background"
            style={{
              minWidth: "40px",
              width: "40px",
              zIndex: 300,
            }}
          >
            <ContentLoader
              speed={2}
              width={35}
              height={cellHeight - 10}
              viewBox={`0 0 35 ${cellHeight - 10}`}
              backgroundColor="#f3f4f6"
              foregroundColor="#ffffff"
            >
              {/* Date number */}
              <rect x="8" y="5" rx="2" ry="2" width="12" height="8" />
              {/* Day of week */}
              <rect x="6" y="18" rx="2" ry="2" width="16" height="6" />
              {/* Additional date info */}
              <rect x="10" y="28" rx="1" ry="1" width="8" height="4" />
            </ContentLoader>
          </TableCell>

          {/* Staff Shift Cells */}
          {Array.from({ length: staffCount }).map((_, staffIndex) => (
            <TableCell
              key={`skeleton-cell-${dateIndex}-${staffIndex}`}
              className={`text-center border-r border-border relative hover:bg-accent ${
                staffIndex === staffCount - 1 ? "border-r-2 border-border" : ""
              }`}
              style={{
                minWidth: "40px",
                width: "40px",
                maxWidth: "40px",
                height: `${cellHeight}px`,
                padding: "0",
              }}
            >
              <div className="w-full h-full flex items-center justify-center">
                <ContentLoader
                  speed={2}
                  width={30}
                  height={30}
                  viewBox="0 0 30 30"
                  backgroundColor="#f9fafb"
                  foregroundColor="#ffffff"
                >
                  {/* Shift symbol placeholder - circular to represent shift symbols */}
                  <circle cx="15" cy="15" r="8" />
                  {/* Small indicator dots */}
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="22" cy="22" r="1.5" />
                </ContentLoader>
              </div>
            </TableCell>
          ))}
        </TableRow>
      ),
    );
  };

  // Generate footer row skeleton
  const renderFooterRow = () => {
    return (
      <TableRow className="bg-yellow-100 border-t-2 border-border">
        <TableCell
          className="text-center font-bold text-xs border-r-2 border-border sticky left-0 bg-yellow-100 py-2"
          style={{ zIndex: 300 }}
        >
          <ContentLoader
            speed={2}
            width={30}
            height={20}
            viewBox="0 0 30 20"
            backgroundColor="#fef3c7"
            foregroundColor="#fde047"
          >
            {/* "休日数" text placeholder */}
            <rect x="4" y="6" rx="2" ry="2" width="22" height="8" />
          </ContentLoader>
        </TableCell>
        {Array.from({ length: staffCount }).map((_, staffIndex) => (
          <TableCell
            key={`skeleton-footer-${staffIndex}`}
            className={`text-center font-bold text-xs border-r border-border bg-yellow-100 py-2 ${
              staffIndex === staffCount - 1 ? "border-r-2" : ""
            }`}
            style={{
              minWidth: "40px",
              width: "40px",
              maxWidth: "40px",
            }}
          >
            <ContentLoader
              speed={2}
              width={20}
              height={16}
              viewBox="0 0 20 16"
              backgroundColor="#fef3c7"
              foregroundColor="#fde047"
            >
              {/* Day off count number */}
              <rect x="6" y="4" rx="2" ry="2" width="8" height="8" />
            </ContentLoader>
          </TableCell>
        ))}
      </TableRow>
    );
  };

  return (
    <div className="relative">
      {/* Minimal status indicator - only when explicitly requested */}
      {showConnectionStatus && (
        <div className="absolute top-2 right-2 z-30">
          <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-full shadow-sm">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600">Syncing</span>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div
        className="table-container overflow-auto"
        style={{ maxHeight: "calc(100vh - 110px)" }}
        role="progressbar"
        aria-label="スケジュール表を読み込み中"
        aria-busy="true"
      >
        <Table
          className="shift-table w-full text-sm"
          style={{ minWidth: `${tableWidth}px` }}
        >
          {/* Sticky Header Row: Staff Names as Column Headers */}
          <TableHeader className="sticky top-0 z-50">
            <TableRow>
              <TableHead
                className="bg-primary text-primary-foreground min-w-[40px] border-r-2 border-border sticky left-0 font-bold"
                style={{ zIndex: 400, width: "40px" }}
              >
                <div className="flex items-center justify-center gap-1 py-0.5">
                  <ContentLoader
                    speed={2}
                    width={30}
                    height={20}
                    viewBox="0 0 30 20"
                    backgroundColor="#1e40af"
                    foregroundColor="#3b82f6"
                    className="opacity-70"
                  >
                    {/* "日付" text placeholder */}
                    <rect x="5" y="6" rx="2" ry="2" width="20" height="8" />
                  </ContentLoader>
                </div>
              </TableHead>

              {/* Staff Column Headers */}
              {renderStaffHeaders()}
            </TableRow>
          </TableHeader>

          {/* Table Body: Date Rows */}
          <TableBody>{renderDateRows()}</TableBody>

          {/* Day Off Count Footer */}
          <TableFooter>{renderFooterRow()}</TableFooter>
        </Table>
      </div>

      {/* Simplified loading indicator - no overlay messages */}
      <div className="absolute top-4 right-4 z-40 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full shadow-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-blue-600 font-medium">Loading</span>
        </div>
      </div>
    </div>
  );
};

// Variant for smaller loading states
export const ScheduleTableSkeletonCompact = ({ staffCount = 3 }) => {
  return (
    <div className="space-y-3">
      {/* Compact header */}
      <div className="flex space-x-2">
        <div className="w-10 h-8 bg-gray-200 rounded animate-pulse"></div>
        {Array.from({ length: staffCount }).map((_, i) => (
          <div
            key={i}
            className="w-10 h-8 bg-gray-200 rounded animate-pulse"
          ></div>
        ))}
      </div>

      {/* Compact rows */}
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-2">
          <div className="w-10 h-10 bg-gray-100 rounded animate-pulse"></div>
          {Array.from({ length: staffCount }).map((_, i) => (
            <div
              key={i}
              className="w-10 h-10 bg-gray-50 rounded animate-pulse flex items-center justify-center"
            >
              <div className="w-4 h-4 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ScheduleTableSkeleton;
