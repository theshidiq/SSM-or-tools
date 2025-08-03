import React, { Suspense, lazy } from "react";

// Lazy load the card view components to reduce initial bundle size
const StaffCardViewOptimized = lazy(() => 
  import("./StaffCardViewOptimized").then(module => ({
    default: module.default
  }))
);

const StaffCardViewVirtualized = lazy(() => 
  import("./StaffCardViewVirtualized").then(module => ({
    default: module.default
  }))
);

// Loading component for card view
const CardViewLoading = React.memo(() => (
  <div className="staff-card-view w-4/5 mx-auto mb-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Skeleton loading cards */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={`skeleton-${i}`}
          className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 animate-pulse"
        >
          {/* Header skeleton */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded mb-2 w-3/4"></div>
              <div className="flex gap-2">
                <div className="h-5 bg-gray-200 rounded w-16"></div>
                <div className="h-5 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          </div>

          {/* Statistics skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={`stat-${j}`} className="text-center p-2 bg-gray-50 rounded-lg">
                <div className="h-6 bg-gray-200 rounded mb-1 w-8 mx-auto"></div>
                <div className="h-3 bg-gray-200 rounded w-10 mx-auto"></div>
              </div>
            ))}
          </div>

          {/* Dates skeleton */}
          <div className="mb-3">
            <div className="h-3 bg-gray-200 rounded w-12 mb-1"></div>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3].map((k) => (
                <div key={`date-${k}`} className="h-6 bg-gray-200 rounded w-8"></div>
              ))}
            </div>
          </div>

          {/* Summary skeleton */}
          <div className="pt-3 border-t border-gray-100">
            <div className="h-3 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
));

CardViewLoading.displayName = 'CardViewLoading';

// Main lazy wrapper component
const StaffCardViewLazy = React.memo(({ 
  orderedStaffMembers, 
  dateRange, 
  schedule, 
  virtualizationThreshold = 50 
}) => {
  const shouldUseVirtualization = orderedStaffMembers?.length > virtualizationThreshold;

  return (
    <Suspense fallback={<CardViewLoading />}>
      {shouldUseVirtualization ? (
        <StaffCardViewVirtualized
          orderedStaffMembers={orderedStaffMembers}
          dateRange={dateRange}
          schedule={schedule}
          threshold={virtualizationThreshold}
        />
      ) : (
        <StaffCardViewOptimized
          orderedStaffMembers={orderedStaffMembers}
          dateRange={dateRange}
          schedule={schedule}
        />
      )}
    </Suspense>
  );
});

StaffCardViewLazy.displayName = 'StaffCardViewLazy';

export default StaffCardViewLazy;