# Simplified Working Calendar Feature - Implementation Plan

## 📋 Overview (Simplified Requirements)

**Purpose**: Mark dates where ALL staff must have day off OR must work (no day off allowed)

**Use Cases**:
1. **Maintenance Period** (例: 1月1日-3日) - ALL staff have day off
2. **Special Events** (例: 12月30日-1月3日 New Year) - ALL staff must work

**Key Simplifications**:
- ❌ NO per-staff configuration
- ❌ NO complex modal with staff lists
- ✅ Just date-level rules applying to ALL staff
- ✅ Simple click → toggle rule type
- ✅ Show 3-4 months at once for comparison

## 🎨 UI Design - Multi-Month View

### Desktop Layout - 3 Months Side by Side

```
┌────────────────────────────────────────────────────────────────────────────────────────────────┐
│  📆 Working Calendar                                                              [⚙️ Settings] │
├────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                 │
│  [ ← Prev 3 Months ]                                                    [ Next 3 Months → ]   │
│                                                                                                 │
│  ┌──────────────────────┬──────────────────────┬──────────────────────┐                       │
│  │   2024年 12月        │   2025年 1月         │   2025年 2月         │                       │
│  │   (December)         │   (January)          │   (February)         │                       │
│  ├──────────────────────┼──────────────────────┼──────────────────────┤                       │
│  │ 日 月 火 水 木 金 土 │ 日 月 火 水 木 金 土 │ 日 月 火 水 木 金 土 │                       │
│  │                      │                      │                      │                       │
│  │  1  2  3  4  5  6  7 │        1  2  3  4  5 │                    1 │                       │
│  │  8  9 10 11 12 13 14 │  6  7  8  9 10 11 12 │  2  3  4  5  6  7  8 │                       │
│  │ 15 16 17 18 19 20 21 │ 13 14 15 16 17 18 19 │  9 10 11 12 13 14 15 │                       │
│  │ 22 23 24 25 26 27 28 │ 20 21 22 23 24 25 26 │ 16 17 18 19 20 21 22 │                       │
│  │ 29 [30][31]          │ 27 28 29 30 31       │ 23 24 25 26 27 28    │                       │
│  │    ⚠️  ⚠️            │ [1][2][3]            │                      │                       │
│  │                      │  ×  ×  ×             │                      │                       │
│  └──────────────────────┴──────────────────────┴──────────────────────┘                       │
│                                                                                                 │
│  Legend:                                                                                        │
│  [Date] - Marked date    ⚠️ - Must work (avoid day off)    × - Must have day off              │
│                                                                                                 │
│  ℹ️ Click date to toggle: Normal → Must Work → Must Day Off → Normal                         │
│                                                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Cell States (Visual Design)

```
State 1: Normal (no rule)
┌────┐
│ 15 │  ← White background, black text
└────┘

State 2: Must Work (avoid day off) - For events
┌────┐
│ 30 │  ← Orange background (#FFA500)
│ ⚠️ │  ← Warning icon
└────┘

State 3: Must Day Off - For maintenance
┌────┐
│ 1  │  ← Grey background (#E5E7EB)
│ ×  │  ← Red off day symbol (#EF4444)
└────┘
```

### Click Interaction

```
Click #1: Normal → Must Work (⚠️)
Click #2: Must Work → Must Day Off (×)
Click #3: Must Day Off → Normal
```

## 📊 Database Schema - SIMPLIFIED

### New Table: `calendar_rules` (date-level only, no staff)

```sql
CREATE TABLE calendar_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id),
    date DATE NOT NULL,
    rule_type VARCHAR(20) NOT NULL,  -- 'must_work' or 'must_day_off'
    reason TEXT,                      -- e.g., "Maintenance", "New Year Event"
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(restaurant_id, date),

    CONSTRAINT valid_rule_type CHECK (rule_type IN ('must_work', 'must_day_off'))
);

CREATE INDEX idx_calendar_rules_date ON calendar_rules(date);
CREATE INDEX idx_calendar_rules_restaurant ON calendar_rules(restaurant_id);
```

**No staff_id column - rules apply to ALL staff uniformly**

**Note**: Future enhancement will add per-staff exceptions in Schedule Settings menu (e.g., during maintenance, some staff work early shift △ while others have day off ×).

## 🏗️ Component Structure - SIMPLIFIED

### New Components (Only 2!)

**1. `src/components/calendar/WorkingCalendarPage.jsx`**
- Shows 3 months side by side (configurable 2-4)
- Month navigation (prev/next 3 months)
- Click cell to toggle rule type
- Legend showing rule types

**2. `src/hooks/useCalendarRules.js`**
```javascript
const useCalendarRules = (restaurantId, startDate, endDate) => {
  // Fetch date-level rules
  // Toggle rule on click
  // WebSocket sync

  return {
    rules,           // { "2025-01-01": "must_day_off", "2024-12-30": "must_work" }
    toggleRule,      // (date) => cycles through: null → must_work → must_day_off → null
    isLoading,
    error
  };
};
```

### Modified Components

**1. `src/components/layout/Sidebar.jsx`** - Activate calendar menu
**2. `src/App.js`** - Add route

**No Settings Modal Changes** - This feature is standalone

## ⚙️ Integration with AI Schedule Generation

### In BusinessRuleValidator.js or ScheduleGenerator.js

```javascript
const checkCalendarRule = (date) => {
  const rule = calendarRules[date];

  if (rule === 'must_day_off') {
    // ALL staff must have × on this date
    return {
      shift: '×',
      reason: 'calendar_maintenance',
      forAllStaff: true
    };
  }

  if (rule === 'must_work') {
    // NO staff can have × on this date
    return {
      shift: '', // Normal shift
      blockOffDay: true,
      reason: 'calendar_event',
      forAllStaff: true
    };
  }

  return null; // No calendar rule
};

// Apply to ALL staff
for (const staff of staffMembers) {
  for (const date of dateRange) {
    const calendarRule = checkCalendarRule(date);

    if (calendarRule?.forAllStaff) {
      if (calendarRule.shift === '×') {
        // Force day off
        schedule[staff.id][date] = '×';
      } else if (calendarRule.blockOffDay) {
        // Prevent day off, force working shift
        if (schedule[staff.id][date] === '×') {
          schedule[staff.id][date] = ''; // Change to normal shift
        }
      }
    }
  }
}
```

## 📝 Implementation Phases - SIMPLIFIED

### Phase 1: Database & API (2 days)
1. Create `calendar_rules` table migration
2. Add API methods in ConfigurationService:
   - `getCalendarRules(restaurantId, startDate, endDate)`
   - `toggleCalendarRule(restaurantId, date)` // Cycles through states
3. Test CRUD operations

### Phase 2: Calendar UI (3 days)
1. Create WorkingCalendarPage.jsx
   - Grid layout for 3 months
   - Click handlers on cells
   - Visual states (normal, must work, must day off)
2. Create useCalendarRules.js hook
3. Add navigation (prev/next 3 months)
4. Add legend

### Phase 3: Routing (1 day)
1. Add route in App.js
2. Activate sidebar menu item
3. Test navigation

### Phase 4: AI Integration (2 days)
1. Add calendar rule checking
2. Apply rules to ALL staff
3. Test with schedule generation
4. Add console logging

### Phase 5: WebSocket & Polish (2 days)
1. WebSocket real-time sync
2. Mobile responsive (show 2 months on mobile)
3. Japanese localization
4. Testing

**Total: ~10 days (2 weeks)**

## 🎯 Success Criteria

✅ Display 3 months side by side (desktop)
✅ Click date to cycle: Normal → Must Work → Must Day Off → Normal
✅ Rules saved to database
✅ ALL staff affected by calendar rules
✅ AI respects calendar rules during generation
✅ WebSocket real-time sync
✅ Mobile shows 2 months stacked

## 🌐 Japanese Localization

- **Page Title**: カレンダールール (Calendar Rules)
- **Must Work**: 出勤必須 (⚠️)
- **Must Day Off**: 休日必須 (×)
- **Legend**: 凡例

## 📱 Responsive Design

**Desktop (≥1280px)**: 3 months side by side
**Tablet (768px-1279px)**: 2 months side by side
**Mobile (<768px)**: 2 months stacked vertically

## 🔄 Example Usage

### Maintenance Period (Jan 1-3)
```
Manager clicks: Jan 1 → Must Day Off (×)
Manager clicks: Jan 2 → Must Day Off (×)
Manager clicks: Jan 3 → Must Day Off (×)

Result: All staff have × on Jan 1, 2, 3
```

### New Year Event (Dec 30 - Jan 3)
```
Manager clicks: Dec 30 → Must Work (⚠️)
Manager clicks: Dec 31 → Must Work (⚠️)
Manager clicks: Jan 1 → Must Work (⚠️)
Manager clicks: Jan 2 → Must Work (⚠️)
Manager clicks: Jan 3 → Must Work (⚠️)

Result: No staff can have × on these dates
        AI assigns normal shifts only
```

## 🔧 Technical Implementation Details

### Data Flow Architecture

```
User Click on Date
    ↓
toggleRule(date) in useCalendarRules
    ↓
Determine next state (normal → must_work → must_day_off → normal)
    ↓
API Call: POST /calendar-rules or DELETE /calendar-rules
    ↓
Update Supabase calendar_rules table
    ↓
WebSocket Broadcast (real-time sync)
    ↓
Update Local State & Re-render Calendar
```

### WebSocket Integration

```javascript
// In useCalendarRules.js
useEffect(() => {
  const channel = supabase
    .channel('calendar_rules')
    .on('postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'calendar_rules'
      },
      (payload) => {
        // Update local rules state
        handleCalendarRuleChange(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [restaurantId]);
```

### AI Schedule Generation Integration Points

**Location**: `src/services/ScheduleGeneratorService.js`

```javascript
// Step 1: Load calendar rules before generation
const calendarRules = await fetchCalendarRules(restaurantId, period);

// Step 2: Apply rules during schedule generation
for (const staff of staffMembers) {
  for (const date of dateRange) {
    const rule = calendarRules[date];

    if (rule === 'must_day_off') {
      schedule[staff.id][date] = '×';
      continue; // Skip other shift assignment logic
    }

    if (rule === 'must_work') {
      // Ensure shift is not ×
      if (schedule[staff.id][date] === '×') {
        schedule[staff.id][date] = assignWorkingShift(staff, date);
      }
    }
  }
}

// Step 3: Validate against calendar rules
const violations = validateCalendarRules(schedule, calendarRules);
if (violations.length > 0) {
  console.warn('Calendar rule violations:', violations);
}
```

## 🧪 Testing Strategy

### Unit Tests
- `useCalendarRules.test.js` - Hook logic and state management
- `WorkingCalendarPage.test.js` - Component rendering and interactions
- `calendarRuleValidator.test.js` - Rule validation logic

### Integration Tests
- Calendar rule CRUD operations
- WebSocket real-time synchronization
- AI schedule generation with calendar rules

### E2E Tests (Chrome MCP)
- Navigate to working calendar page
- Click dates to toggle rules
- Verify visual state changes
- Generate schedule with calendar rules applied
- Verify all staff affected by rules

## 📂 File Structure

```
src/
├── components/
│   └── calendar/
│       ├── WorkingCalendarPage.jsx        (NEW)
│       ├── MonthGrid.jsx                  (NEW - Optional sub-component)
│       └── CalendarLegend.jsx             (NEW - Optional sub-component)
├── hooks/
│   └── useCalendarRules.js                (NEW)
├── services/
│   ├── CalendarRuleService.js             (NEW)
│   └── ScheduleGeneratorService.js        (MODIFIED - Add rule checking)
├── utils/
│   └── calendarRuleValidator.js           (NEW)
└── App.js                                 (MODIFIED - Add route)
```

## 🚀 Deployment Checklist

- [ ] Database migration applied to production
- [ ] Calendar rules API endpoints tested
- [ ] WebSocket integration verified
- [ ] AI schedule generation respects rules
- [ ] Mobile responsive design validated
- [ ] Japanese localization complete
- [ ] Performance testing (1000+ rules)
- [ ] Cross-browser compatibility checked
- [ ] User documentation updated
- [ ] Chrome MCP E2E tests passing

## 🎨 Color Scheme

```css
/* Normal date - No rule */
.calendar-cell-normal {
  background-color: #FFFFFF;
  color: #000000;
  border: 1px solid #E5E7EB;
}

/* Must Work - Event days */
.calendar-cell-must-work {
  background-color: #FFA500;
  color: #FFFFFF;
  border: 1px solid #FF8C00;
}

/* Must Day Off - Maintenance days */
.calendar-cell-must-day-off {
  background-color: #E5E7EB; /* Grey background */
  color: #EF4444; /* Red text for × symbol */
  border: 1px solid #D1D5DB;
}

/* Hover states */
.calendar-cell:hover {
  opacity: 0.8;
  cursor: pointer;
  transform: scale(1.05);
  transition: all 0.2s ease-in-out;
}
```

## 💡 Future Enhancements (Not in MVP)

### Phase 6: Maintenance Staff Exceptions (Future)
- **Add settings in Schedule Menu** to configure which staff work during maintenance
- **Example**: April 10-14 marked "Must Day Off", but Tanaka & Suzuki work △ (early shift)
- **Database**: Add `maintenance_staff_exceptions` table with staff_id references
- **AI Logic**: Override calendar rules for specific staff members

### Other Future Features
- Bulk date selection (click & drag to mark ranges)
- Import calendar rules from CSV
- Recurring rules (e.g., "Every Sunday is must work")
- Calendar rule templates (e.g., "New Year Template")
- Reason field with autocomplete suggestions
- Calendar rule history and audit log
- Conflict warnings when rules overlap with existing schedules

---

**This simplified approach eliminates 80% of the complexity while delivering the core functionality needed for restaurant shift management.**

## 📞 Support & Questions

For questions or issues during implementation:
1. Review this plan document
2. Check CLAUDE.md for architecture guidelines
3. Refer to existing components for patterns (e.g., ScheduleTable.jsx for grid layouts)
4. Test incrementally with Chrome MCP integration

**Last Updated**: 2025-11-19
**Version**: 1.0 (Simplified)
**Status**: Ready for Implementation
