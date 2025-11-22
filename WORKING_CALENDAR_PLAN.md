# Working Calendar Feature - Implementation Plan

## 📋 Overview

Based on user requirements:
- Traditional monthly calendar grid view
- Click dates to configure staff working rules
- Two rule types: "Day Off" (×) and "Avoid Shift"
- Priority system: Morning shift (△) overrides day off rule
- Status-based morning shift eligibility settings (社員, 派遣, パート)
- New Supabase table with WebSocket real-time sync
- Integration with AI schedule generation

## 🎨 UI Design

### Calendar View - Recommended: 1 Month Per Page

```
┌────────────────────────────────────────────────────────────┐
│  Working Calendar - January 2025              [< Prev | Next >] │
├────────────────────────────────────────────────────────────┤
│  Sun   Mon   Tue   Wed   Thu   Fri   Sat                  │
│ ┌────┬────┬────┬────┬────┬────┬────┐                     │
│ │ 29 │ 30 │ 31 │ 1  │ 2  │ 3  │ 4  │ Week 1            │
│ │    │    │    │ 👥 │ 👥 │ 👥 │ 👥 │                   │
│ │    │    │    │ 5  │ 4  │ 6  │ 3  │ (staff count)     │
│ ├────┼────┼────┼────┼────┼────┼────┤                     │
│ │ 5  │ 6  │ 7  │ 8  │ 9  │ 10 │ 11 │ Week 2            │
│ │ 👥 │ 👥 │ 👥 │ 👥 │ 👥 │ 👥 │ 👥 │                   │
│ │ 2  │ 5  │ 6  │ 5  │ 5  │ 4  │ 2  │                   │
│ └────┴────┴────┴────┴────┴────┴────┘                     │
│                                                             │
│ Click date to configure → Opens staff list modal           │
└────────────────────────────────────────────────────────────┘
```

**Alternative: 2 Months Side-by-Side**
- Desktop: Two months displayed horizontally
- Mobile: Stack vertically
- Better for planning ahead

### Modal: Per-Date Staff Configuration

```
┌─────────────────────────────────────┐
│ Configure: January 15, 2025         │
├─────────────────────────────────────┤
│ ☑ 井岡 (社員)          × Day Off    │
│ ☐ 安井 (派遣)         ○ Working     │
│ ☑ カマル (社員)        × Day Off    │
│ ☐ 中田 (パート)       ○ Working     │
│                                      │
│ [ Select All ] [ Clear All ]        │
│                  [ Save ] [ Cancel ] │
└─────────────────────────────────────┘
```

### Settings: Morning Shift Eligibility

```
┌─────────────────────────────────────┐
│ Morning Shift (△) Eligibility       │
├─────────────────────────────────────┤
│ ☑ 社員 (Regular)     Can work △    │
│ ☐ 派遣 (Temporary)   Cannot work △  │
│ ☐ パート (Part-time) Cannot work △  │
│                                      │
│                  [ Save ] [ Cancel ] │
└─────────────────────────────────────┘
```

## 📊 Database Schema

### New Table: `working_calendars`

```sql
CREATE TABLE working_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    staff_id UUID NOT NULL REFERENCES staff(id),
    date DATE NOT NULL,
    rule_type VARCHAR(20) NOT NULL, -- 'day_off' or 'avoid_shift'
    is_active BOOLEAN DEFAULT true,
    priority_level INTEGER DEFAULT 4, -- Matches priority_rules.priority_level
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(restaurant_id, staff_id, date),

    CONSTRAINT valid_rule_type CHECK (rule_type IN ('day_off', 'avoid_shift'))
);

CREATE INDEX idx_working_calendars_date ON working_calendars(date);
CREATE INDEX idx_working_calendars_staff ON working_calendars(staff_id);
CREATE INDEX idx_working_calendars_restaurant ON working_calendars(restaurant_id);
```

**Key Fields**:
- `rule_type`: "day_off" (strict) vs "avoid_shift" (preference)
- `priority_level`: 4 (high priority, same as current priority rules)
- `is_active`: Soft delete flag

### Settings Storage

**In ConfigurationService (localStorage + Supabase sync):**

```javascript
{
  morningShiftEligibility: {
    "社員": true,    // Can work morning shifts (current default)
    "派遣": false,   // Configurable
    "パート": false  // Configurable
  }
}
```

## 🏗️ Component Structure

### New Components

**1. `src/components/calendar/WorkingCalendarPage.jsx`**
- Main calendar page component
- Month navigation (prev/next buttons)
- Calendar grid rendering (7 columns × ~5 rows)
- Staff count badges per date
- Click handlers to open modal
- WebSocket subscription for real-time updates

**2. `src/components/calendar/CalendarDayModal.jsx`**
- Per-date staff configuration modal
- Staff list with checkboxes
- Day off toggle per staff
- Bulk operations (Select All, Clear All)
- Save to working_calendars table

**3. `src/components/calendar/CalendarGrid.jsx`**
- Reusable calendar grid component
- Weeks as rows, weekdays as columns
- Previous/next month overflow dates
- Day cell rendering with badges

**4. `src/components/calendar/MorningShiftSettings.jsx`**
- Status-based morning shift eligibility configuration
- Checkbox per staff status type
- Save to settings configuration

### Modified Components

**1. `src/components/layout/Sidebar.jsx`**
```javascript
// Change from inactive to active route
{
  id: "calendar",
  label: "Calendar",
  icon: CalendarDays,
  type: "nav",
  path: "/working-calendar"  // Add this
}
```

**2. `src/App.js`**
```javascript
import WorkingCalendarPage from './components/calendar/WorkingCalendarPage';

// Add route
<Route path="/working-calendar" element={<WorkingCalendarPage />} />
```

**3. `src/components/settings/SettingsModal.jsx`**
```javascript
// Add new tab
<TabsTrigger value="working-calendar">📅 Working Calendar</TabsTrigger>

<TabsContent value="working-calendar">
  <MorningShiftSettings
    settings={settings}
    updateSettings={updateSettings}
  />
</TabsContent>
```

### New Hooks

**`src/hooks/useWorkingCalendar.js`**

```javascript
const useWorkingCalendar = (restaurantId, startDate, endDate) => {
  // Fetch calendar rules for date range from working_calendars table
  // WebSocket real-time sync
  // CRUD operations

  return {
    calendarRules,      // Array of rules by date
    staffCounts,        // { "2025-01-15": 5, ... }
    setDayOff,          // (staffId, date) => Promise
    clearDayOff,        // (staffId, date) => Promise
    bulkSetDayOff,      // (staffIds[], date) => Promise
    isLoading,
    error,
    refetch
  };
};
```

## ⚙️ Integration Logic

### Priority System (per user requirement)

**Rule**: Morning shift (△) > Day off (×)

```javascript
// In BusinessRuleValidator.js or ScheduleGenerator.js

const checkWorkingCalendarRules = (staff, dateKey, schedule) => {
  // 1. Check if working calendar has day_off rule for this staff+date
  const dayOffRule = workingCalendarRules.find(r =>
    r.staff_id === staff.id &&
    r.date === dateKey &&
    r.rule_type === 'day_off' &&
    r.is_active
  );

  if (!dayOffRule) return null; // No rule applies

  // 2. Check if staff already has morning shift (△)
  const currentShift = schedule[staff.id]?.[dateKey];

  if (currentShift === '△') {
    // Morning shift overrides day off rule
    console.log(
      `⏭️ [WORKING-CALENDAR] ${staff.name}: Day off rule on ${dateKey} ` +
      `IGNORED (has morning shift △)`
    );
    return null; // Don't enforce day off
  }

  // 3. Enforce day off
  return {
    shift: '×',
    reason: 'working_calendar_day_off',
    priority: dayOffRule.priority_level
  };
};
```

### Morning Shift Eligibility

**Update in ScheduleGenerator.js:**

```javascript
isEligibleForEarlyShift(staff) {
  const settings = this.getSettings();
  const eligibility = settings.morningShiftEligibility || {
    "社員": true,
    "派遣": false,
    "パート": false
  };

  return eligibility[staff.status] ?? false;
}
```

**Usage in AI generation:**

```javascript
// Before assigning △
if (this.isEligibleForEarlyShift(staff)) {
  // Can assign △
} else {
  console.log(
    `⏭️ [MORNING-SHIFT] ${staff.name} (${staff.status}): ` +
    `Not eligible for morning shift`
  );
  // Skip △ assignment
}
```

## 🔄 WebSocket Integration

### New Message Types

**Go Server (`go-server/main.go`):**

```go
const (
    // Existing types...
    MSG_WORKING_CALENDAR_SYNC_REQUEST  = "WORKING_CALENDAR_SYNC_REQUEST"
    MSG_WORKING_CALENDAR_SYNC_RESPONSE = "WORKING_CALENDAR_SYNC_RESPONSE"
    MSG_WORKING_CALENDAR_UPDATE        = "WORKING_CALENDAR_UPDATE"
    MSG_WORKING_CALENDAR_DELETE        = "WORKING_CALENDAR_DELETE"
)
```

### Client Subscription

```javascript
// In useWorkingCalendar.js
useEffect(() => {
  const handleCalendarUpdate = (message) => {
    if (message.type === 'WORKING_CALENDAR_UPDATE') {
      // Update local state
      setCalendarRules(prev => {
        // Merge or replace rule
      });
    }
  };

  wsClient.subscribe('working_calendar', handleCalendarUpdate);

  return () => {
    wsClient.unsubscribe('working_calendar', handleCalendarUpdate);
  };
}, []);
```

## 📝 Implementation Phases

### Phase 1: Database & Backend (3-4 days)

**Tasks**:
1. Create migration: `database/migrations/010_create_working_calendars.sql`
2. Test migration on local Supabase
3. Add WebSocket message types in Go server
4. Create API methods in ConfigurationService.js:
   - `getWorkingCalendarRules(restaurantId, startDate, endDate)`
   - `setWorkingCalendarRule(rule)`
   - `deleteWorkingCalendarRule(id)`
   - `bulkSetWorkingCalendarRules(rules[])`

**Deliverables**:
- ✅ Database table created
- ✅ API methods tested
- ✅ WebSocket message types working

### Phase 2: Core Components (5-7 days)

**Tasks**:
1. Create WorkingCalendarPage.jsx
   - Month navigation state
   - Calendar grid rendering
   - Date click handlers
2. Create CalendarGrid.jsx
   - Week/day grid layout
   - Staff count badges
   - Responsive styling
3. Create CalendarDayModal.jsx
   - Staff list with checkboxes
   - Bulk operations
   - Save/cancel handlers
4. Create useWorkingCalendar.js hook
   - Fetch rules from API
   - WebSocket subscription
   - CRUD operations

**Deliverables**:
- ✅ Calendar displays correctly
- ✅ Date clicks open modal
- ✅ Can mark staff for day off
- ✅ Changes save to database

### Phase 3: Settings & Eligibility (2-3 days)

**Tasks**:
1. Create MorningShiftSettings.jsx
   - Checkbox per staff status
   - Save to ConfigurationService
2. Add tab to SettingsModal.jsx
3. Update ScheduleGenerator.isEligibleForEarlyShift()
4. Test eligibility changes affect AI generation

**Deliverables**:
- ✅ Morning shift eligibility configurable
- ✅ Settings persist correctly
- ✅ AI respects eligibility rules

### Phase 4: AI Integration (3-4 days)

**Tasks**:
1. Add working calendar rule checking in BusinessRuleValidator.js
2. Implement priority system (△ > ×)
3. Add console logging for debugging
4. Test various calendar configurations:
   - Staff with day off rule
   - Staff with day off + morning shift
   - Multiple staff on same date
   - Edge cases (month boundaries, etc.)

**Deliverables**:
- ✅ Day off rules enforced
- ✅ Morning shift overrides day off
- ✅ Avoid shift reduces probability
- ✅ Console logs help debug

### Phase 5: Routing & Navigation (1-2 days)

**Tasks**:
1. Add route in App.js
2. Activate sidebar menu item
3. Test navigation flow
4. Add breadcrumbs/back button if needed

**Deliverables**:
- ✅ Calendar accessible from sidebar
- ✅ Navigation works smoothly
- ✅ URL routing correct

### Phase 6: Polish & Testing (3-5 days)

**Tasks**:
1. Mobile responsive design
   - Touch-friendly date cells
   - Modal mobile layout
   - Calendar grid mobile view
2. Japanese localization
   - 出勤カレンダー (Working Calendar)
   - 休み (Day off)
   - 早番不可 (Cannot work morning shift)
3. Performance optimization
   - Memoize calendar grid
   - Lazy load modal
   - Optimize WebSocket updates
4. User testing
   - Test with real data
   - Gather feedback
   - Fix bugs

**Deliverables**:
- ✅ Mobile responsive
- ✅ Japanese labels correct
- ✅ Performance acceptable
- ✅ No critical bugs

## 🎯 Success Criteria

### Functional Requirements

- ✅ Display traditional monthly calendar grid
- ✅ Click date → open staff configuration modal
- ✅ Mark staff for "day off" or "avoid shift"
- ✅ Save rules to working_calendars table
- ✅ Morning shift (△) overrides day off (×)
- ✅ Configure morning shift eligibility by staff status
- ✅ WebSocket real-time sync across clients
- ✅ Integration with AI schedule generation

### Non-Functional Requirements

- ✅ Page load < 2 seconds
- ✅ Modal open < 500ms
- ✅ WebSocket update propagation < 200ms
- ✅ Mobile responsive (44px touch targets)
- ✅ Japanese localization complete
- ✅ Accessibility (keyboard navigation, ARIA labels)

## 🌐 Localization

### Japanese Labels

- **Page Title**: 出勤カレンダー (Working Calendar)
- **Day Off**: 休み
- **Avoid Shift**: シフト回避
- **Morning Shift**: 早番
- **Settings Tab**: 出勤カレンダー設定
- **Eligibility**: 資格
- **Staff Status**: スタッフステータス

### Date Formatting

Use `date-fns` with `ja` locale:

```javascript
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const formattedDate = format(date, 'yyyy年M月d日 (E)', { locale: ja });
// Output: "2025年1月15日 (水)"
```

## 📱 Responsive Design Strategy

### Breakpoints

- **Desktop** (≥1024px): 2 months side-by-side (optional)
- **Tablet** (768px-1023px): 1 month, full width
- **Mobile** (< 768px): 1 month, compact view

### Touch Targets

- Minimum 44px × 44px for date cells
- Minimum 48px × 48px for buttons
- Adequate spacing between interactive elements

### Modal Behavior

- Desktop: Center modal, max-width 600px
- Mobile: Full-screen modal, bottom sheet style

## 🔐 Security Considerations

### Access Control

- Verify `restaurant_id` matches authenticated user's restaurant
- Prevent cross-restaurant data access
- WebSocket authentication required

### Data Validation

```javascript
// Server-side validation
const validateWorkingCalendarRule = (rule) => {
  if (!['day_off', 'avoid_shift'].includes(rule.rule_type)) {
    throw new Error('Invalid rule_type');
  }

  if (!isValidDate(rule.date)) {
    throw new Error('Invalid date');
  }

  if (!isValidUUID(rule.staff_id)) {
    throw new Error('Invalid staff_id');
  }

  // Restaurant ownership check
  const staff = await getStaff(rule.staff_id);
  if (staff.restaurant_id !== rule.restaurant_id) {
    throw new Error('Unauthorized access');
  }
};
```

## 🐛 Potential Issues & Solutions

### Issue 1: Calendar Rule vs Priority Rule Conflict

**Problem**: Both systems might try to enforce different shifts

**Solution**:
- Working calendar rules have priority_level = 4 (high)
- Check working calendar BEFORE priority rules
- Morning shift check happens AFTER both systems

### Issue 2: Performance with Many Staff Members

**Problem**: Large restaurants (100+ staff) = slow modal rendering

**Solution**:
- Virtualized list in modal (react-window)
- Pagination (show 20 staff at a time)
- Search/filter functionality

### Issue 3: Date Range Boundaries

**Problem**: Calendar displays dates from prev/next month

**Solution**:
- Fetch rules for entire displayed date range (prev month + current + next)
- Gray out dates outside current month
- Click handler still works for all dates

### Issue 4: WebSocket Sync Conflicts

**Problem**: Multiple users editing same date simultaneously

**Solution**:
- Last Writer Wins strategy (existing pattern)
- Show toast notification on conflict
- Refetch data after update

## 📚 References

### Existing Code Patterns to Follow

1. **Modal Structure**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/schedule/StaffEditModal.jsx`
2. **Settings Tabs**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/settings/SettingsModal.jsx`
3. **WebSocket Hook**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/hooks/useWebSocketStaff.js`
4. **Configuration Service**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/services/ConfigurationService.js`
5. **Date Handling**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/components/schedule/ScheduleTable.jsx`

### External Libraries

- **ShadCN UI**: Dialog, Button, Input, Select, Checkbox
- **date-fns**: Date formatting and manipulation
- **React Router**: Page navigation
- **TanStack Query**: Data fetching (optional)

## 🚀 Future Enhancements (Not in MVP)

- Import/export calendar rules (CSV, JSON)
- Recurring rules (every Monday, every other week, etc.)
- Calendar templates (save common patterns)
- Multi-month bulk edit
- Calendar rule analytics (most used dates, staff coverage gaps)
- Integration with Google Calendar / iCal export

---

**Total Estimated Time**: 3-4 weeks for full implementation

**MVP Scope**: Phases 1-5 (2-3 weeks)

**This plan follows existing codebase patterns and integrates cleanly with current architecture. Ready for review and implementation approval.**
