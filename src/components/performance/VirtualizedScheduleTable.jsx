import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { FixedSizeGrid as Grid } from 'react-window';

// Virtualized schedule table for handling large datasets efficiently
const VirtualizedScheduleTable = React.memo(({
  schedule = {},
  staffMembers = [],
  dateRange = [],
  onShiftChange,
  editingLocks = new Map(),
  userCursors = new Map(),
  currentUser,
  isReadOnly = false,
  className = '',
  rowHeight = 40,
  columnWidth = 80,
  headerHeight = 60,
  stickyColumns = 1, // Number of columns to keep sticky (staff names)
  maxVisibleRows = 20,
  maxVisibleColumns = 31
}) => {
  const gridRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: 1200,
    height: 600
  });

  // Memoized data preparation
  const gridData = useMemo(() => {
    const dates = dateRange.map(date => date.toISOString().split('T')[0]);
    const staff = staffMembers.filter(s => s && s.id);
    
    return {
      staff,
      dates,
      rowCount: staff.length,
      columnCount: dates.length + stickyColumns, // +1 for staff name column
      schedule
    };
  }, [schedule, staffMembers, dateRange, stickyColumns]);

  // Memoized cell renderer
  const CellRenderer = useCallback(({ columnIndex, rowIndex, style }) => {
    const { staff, dates, schedule: scheduleData } = gridData;
    
    if (rowIndex >= staff.length) return null;
    
    const staffMember = staff[rowIndex];
    const isStaffNameColumn = columnIndex < stickyColumns;
    
    // Render staff name column
    if (isStaffNameColumn) {
      return (
        <StaffNameCell
          key={`staff-${staffMember.id}`}
          style={style}
          staffMember={staffMember}
          rowIndex={rowIndex}
        />
      );
    }
    
    // Render schedule cells
    const dateIndex = columnIndex - stickyColumns;
    if (dateIndex >= dates.length) return null;
    
    const dateKey = dates[dateIndex];
    const shiftValue = scheduleData[staffMember.id]?.[dateKey] || '';
    
    return (
      <ScheduleCell
        key={`cell-${staffMember.id}-${dateKey}`}
        style={style}
        staffId={staffMember.id}
        dateKey={dateKey}
        value={shiftValue}
        rowIndex={rowIndex}
        columnIndex={columnIndex}
        onShiftChange={onShiftChange}
        isLocked={editingLocks.has(`${staffMember.id}:${dateKey}`)}
        lockInfo={editingLocks.get(`${staffMember.id}:${dateKey}`)}
        cursors={Array.from(userCursors.values()).filter(
          c => c.staffId === staffMember.id && c.dateKey === dateKey
        )}
        isReadOnly={isReadOnly}
        dateIndex={dateIndex}
      />
    );
  }, [gridData, onShiftChange, editingLocks, userCursors, isReadOnly, stickyColumns]);

  // Header renderer for dates
  const HeaderRenderer = useCallback(({ columnIndex, style }) => {
    const { dates } = gridData;
    const isStaffNameColumn = columnIndex < stickyColumns;
    
    if (isStaffNameColumn) {
      return (
        <div
          style={{
            ...style,
            background: '#F3F4F6',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          スタッフ
        </div>
      );
    }
    
    const dateIndex = columnIndex - stickyColumns;
    if (dateIndex >= dates.length) return null;
    
    const date = new Date(dates[dateIndex]);
    const dayName = date.toLocaleDateString('ja-JP', { weekday: 'short' });
    const dayNumber = date.getDate();
    
    return (
      <DateHeaderCell
        key={`header-${dates[dateIndex]}`}
        style={style}
        date={date}
        dayName={dayName}
        dayNumber={dayNumber}
        dateIndex={dateIndex}
      />
    );
  }, [gridData, stickyColumns]);

  // Calculate optimal dimensions
  useEffect(() => {
    const calculateDimensions = () => {
      const container = gridRef.current?.parentElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const availableWidth = Math.max(800, containerRect.width - 40);
      const availableHeight = Math.max(400, containerRect.height - 100);
      
      // Calculate optimal column count based on available width
      const maxColumns = Math.min(
        maxVisibleColumns,
        Math.floor((availableWidth - (stickyColumns * columnWidth)) / columnWidth) + stickyColumns
      );
      
      // Calculate optimal row count based on available height
      const maxRows = Math.min(
        maxVisibleRows,
        Math.floor((availableHeight - headerHeight) / rowHeight)
      );
      
      const width = Math.min(availableWidth, maxColumns * columnWidth);
      const height = Math.min(availableHeight, (maxRows * rowHeight) + headerHeight);
      
      setDimensions({ width, height });
    };
    
    calculateDimensions();
    
    const resizeObserver = new ResizeObserver(calculateDimensions);
    const container = gridRef.current?.parentElement;
    if (container) {
      resizeObserver.observe(container);
    }
    
    return () => {
      if (container) {
        resizeObserver.unobserve(container);
      }
    };
  }, [columnWidth, rowHeight, headerHeight, maxVisibleColumns, maxVisibleRows, stickyColumns]);

  // Scroll to specific cell
  const scrollToCell = useCallback((staffIndex, dateIndex) => {
    if (gridRef.current) {
      gridRef.current.scrollToItem({
        rowIndex: staffIndex,
        columnIndex: dateIndex + stickyColumns
      });
    }
  }, [stickyColumns]);

  // Calculate total dimensions
  const totalWidth = gridData.columnCount * columnWidth;
  const totalHeight = (gridData.rowCount * rowHeight) + headerHeight;

  return (
    <div className={`virtualized-schedule-table ${className}`} style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ height: headerHeight, position: 'relative', zIndex: 2 }}>
        <Grid
          width={dimensions.width}
          height={headerHeight}
          columnCount={gridData.columnCount}
          rowCount={1}
          columnWidth={columnWidth}
          rowHeight={headerHeight}
          style={{ overflow: 'hidden' }}
        >
          {({ columnIndex, style }) => HeaderRenderer({ columnIndex, style })}
        </Grid>
      </div>
      
      {/* Main grid */}
      <div style={{ height: dimensions.height - headerHeight }}>
        <Grid
          ref={gridRef}
          width={dimensions.width}
          height={dimensions.height - headerHeight}
          columnCount={gridData.columnCount}
          rowCount={gridData.rowCount}
          columnWidth={columnWidth}
          rowHeight={rowHeight}
          overscanRowCount={5}
          overscanColumnCount={3}
        >
          {CellRenderer}
        </Grid>
      </div>
      
      {/* Performance info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          {gridData.rowCount} × {gridData.columnCount} cells
          {totalWidth > dimensions.width || totalHeight > dimensions.height - headerHeight
            ? ' (virtualized)' 
            : ' (all visible)'
          }
        </div>
      )}
    </div>
  );
});

// Memoized staff name cell component
const StaffNameCell = React.memo(({ style, staffMember, rowIndex }) => {
  return (
    <div
      style={{
        ...style,
        background: '#F9FAFB',
        border: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '8px',
        fontWeight: '500',
        fontSize: '13px',
        position: 'sticky',
        left: 0,
        zIndex: 1
      }}
      title={`${staffMember.name} (${staffMember.position})`}
    >
      <div className="truncate">
        {staffMember.name}
      </div>
      {staffMember.type === 'part-time' && (
        <span className="ml-1 text-xs text-blue-600">P</span>
      )}
    </div>
  );
});

// Memoized date header cell component
const DateHeaderCell = React.memo(({ style, date, dayName, dayNumber, dateIndex }) => {
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isToday = date.toDateString() === new Date().toDateString();
  
  return (
    <div
      style={{
        ...style,
        background: isToday ? '#FEF3C7' : isWeekend ? '#FEE2E2' : '#F3F4F6',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: isToday ? '600' : '500'
      }}
    >
      <div className={isWeekend ? 'text-red-600' : 'text-gray-700'}>
        {dayName}
      </div>
      <div className={`text-lg ${isToday ? 'text-yellow-800' : isWeekend ? 'text-red-600' : 'text-gray-900'}`}>
        {dayNumber}
      </div>
    </div>
  );
});

// Memoized schedule cell component with optimizations
const ScheduleCell = React.memo(({ 
  style, 
  staffId, 
  dateKey, 
  value, 
  rowIndex, 
  columnIndex,
  onShiftChange,
  isLocked,
  lockInfo,
  cursors,
  isReadOnly,
  dateIndex
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);
  
  const date = new Date(dateKey);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isToday = date.toDateString() === new Date().toDateString();
  
  // Update temp value when props change
  useEffect(() => {
    if (!isEditing) {
      setTempValue(value);
    }
  }, [value, isEditing]);
  
  const handleClick = useCallback((e) => {
    if (isReadOnly || isLocked) return;
    
    e.preventDefault();
    setIsEditing(true);
  }, [isReadOnly, isLocked]);
  
  const handleChange = useCallback((e) => {
    setTempValue(e.target.value);
  }, []);
  
  const handleBlur = useCallback(() => {
    if (tempValue !== value) {
      onShiftChange?.(staffId, dateKey, tempValue);
    }
    setIsEditing(false);
  }, [tempValue, value, onShiftChange, staffId, dateKey]);
  
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setTempValue(value);
      setIsEditing(false);
    }
  }, [value]);
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  // Cell background color logic
  const getBackgroundColor = () => {
    if (isLocked) return '#FEE2E2'; // Light red for locked
    if (isToday) return '#FEF3C7'; // Light yellow for today
    if (isWeekend) return '#F3F4F6'; // Light gray for weekend
    if (value === '×') return '#FECACA'; // Light red for day off
    return '#FFFFFF'; // White for normal days
  };
  
  return (
    <div
      style={{
        ...style,
        background: getBackgroundColor(),
        border: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: isReadOnly || isLocked ? 'not-allowed' : 'pointer'
      }}
      onClick={handleClick}
      title={isLocked ? `編集中: ${lockInfo?.userName || 'Unknown User'}` : undefined}
    >
      {/* Cursor indicators */}
      {cursors.map((cursor, idx) => (
        <div
          key={`cursor-${cursor.userId}-${idx}`}
          className="absolute top-0 left-0 w-1 h-full opacity-60"
          style={{
            backgroundColor: cursor.userColor,
            zIndex: 10
          }}
          title={cursor.userName}
        />
      ))}
      
      {/* Lock indicator */}
      {isLocked && (
        <div className="absolute top-1 right-1">
          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        </div>
      )}
      
      {/* Cell content */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={tempValue}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full text-center border-none outline-none bg-transparent text-sm"
          maxLength={10}
        />
      ) : (
        <div className="text-center text-sm font-medium">
          {value || ''}
        </div>
      )}
    </div>
  );
});

VirtualizedScheduleTable.displayName = 'VirtualizedScheduleTable';
StaffNameCell.displayName = 'StaffNameCell';
DateHeaderCell.displayName = 'DateHeaderCell';
ScheduleCell.displayName = 'ScheduleCell';

export default VirtualizedScheduleTable;