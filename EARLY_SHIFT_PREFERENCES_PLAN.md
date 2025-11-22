# Staff Early Shift Preferences - Plan & Wireframe

## 1. Feature Overview

### Purpose
Allow managers to configure which staff members should be assigned early shifts (△) based on their monthly work calendar. This preference will be read by the AI schedule generator to create more optimized and fair schedules.

### Key Requirements
- Read-only monthly calendar view from the Calendar menu
- Staff selection interface for early shift preference
- Database storage for preferences
- Integration with AI schedule generation
- Restaurant-specific configuration

---

## 2. Database Schema Design

### New Table: `staff_early_shift_preferences` (SIMPLIFIED)

```sql
CREATE TABLE staff_early_shift_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,

  can_do_early_shift BOOLEAN NOT NULL DEFAULT false,
  -- Simple checkbox: true = can do early shifts, false = cannot

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preference per staff per restaurant
  UNIQUE(restaurant_id, staff_id)
);

-- Index for fast lookups
CREATE INDEX idx_early_shift_prefs_restaurant ON staff_early_shift_preferences(restaurant_id);
CREATE INDEX idx_early_shift_prefs_staff ON staff_early_shift_preferences(staff_id);
CREATE INDEX idx_early_shift_prefs_can_do ON staff_early_shift_preferences(can_do_early_shift);
```

### Alternative: Extend Existing `staff` Table

If you prefer not to create a new table, we could add a single column to the existing `staff` table:

```sql
ALTER TABLE staff ADD COLUMN can_do_early_shift BOOLEAN DEFAULT false;
```

**Recommendation**: Use a separate table for better data organization and restaurant-specific preferences.

**Key Simplifications:**
- ❌ Removed `preference_type` (prefer/avoid/neutral) - too complex
- ❌ Removed `priority` field - unnecessary complexity
- ❌ Removed `notes` field - not needed for simple checkbox
- ✅ Single boolean: `can_do_early_shift` (true/false)
- ✅ Much simpler for managers to understand

---

## 3. User Interface Wireframe

### Settings Modal - New "Early Shift" Tab (SIMPLIFIED)

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings                                                    [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────┬──────────────┬────────────────┬─────────────┐    │
│  │ Priority  │ Staff Groups │ Weekly Limits  │ Early Shift │◄── New Tab
│  └───────────┴──────────────┴────────────────┴─────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  📅 Monthly Calendar Preview (Read-Only)                │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  2025年11月 - 2026年1月                          │    │    │
│  │  │                                                   │    │    │
│  │  │  [3-month calendar grid showing must_work/off]   │    │    │
│  │  │   ⚠️ = Must Work Days                            │    │    │
│  │  │   × = Must Day Off Days                          │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  👥 早番希望スタッフ (社員のみ)                          │    │
│  │      Staff Who Can Do Early Shifts (Regular Staff Only) │    │
│  │                                                           │    │
│  │  ┌───────────────────────────────────────────────┐      │    │
│  │  │ ☑️ 田中太郎 (社員)                             │      │    │
│  │  │ ☑️ 佐藤花子 (社員)                             │      │    │
│  │  │ ☐ 鈴木一郎 (社員)                             │      │    │
│  │  │ ☑️ 高橋美咲 (社員)                             │      │    │
│  │  │ ☐ 山田太朗 (社員)                             │      │    │
│  │  │ ☑️ 伊藤次郎 (社員)                             │      │    │
│  │  └───────────────────────────────────────────────┘      │    │
│  │                                                           │    │
│  │  ℹ️  チェックしたスタッフが早番(△)に優先的に配置        │    │
│  │      されます。                                           │    │
│  │                                                           │    │
│  │  📊 現在の選択: 4人 / 6人の社員                         │    │
│  │                                                           │    │
│  │  [すべて選択]  [すべて解除]                             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  [キャンセル]                                [保存]              │
└─────────────────────────────────────────────────────────────────┘
```

**Key Changes:**
- ❌ Removed priority slider (too complex)
- ❌ Removed 3-option dropdown (prefer/avoid/neutral)
- ✅ Simple checkbox list: checked = can do early shift
- ✅ Filter to show only 社員 (regular staff), exclude アルバイト
- ✅ Show count of selected staff
- ✅ Quick action buttons: Select All / Deselect All

---

## 4. Component Structure

### New Components to Create

```
src/components/settings/
├── EarlyShiftPreferencesTab.jsx      # Main tab component
├── CalendarPreview.jsx               # Read-only calendar display
├── StaffPreferenceRow.jsx            # Individual staff row
└── PrioritySlider.jsx                # Priority slider component
```

### Component Hierarchy

```
SettingsModal
└── EarlyShiftPreferencesTab
    ├── CalendarPreview (read-only from Calendar data)
    ├── StaffPreferenceList
    │   └── StaffPreferenceRow (for each staff)
    │       ├── StaffInfo (name, avatar)
    │       ├── PreferenceDropdown (prefer/avoid/neutral)
    │       └── PrioritySlider (0-100)
    └── ActionButtons (save, cancel, reset)
```

---

## 5. Data Flow

### Reading Calendar Rules
```
Calendar Menu (sidebar)
    → useCalendarRules hook
        → Fetch from `calendar_rules` table
            → Display in CalendarPreview (read-only)
```

### Managing Preferences
```
Settings → Early Shift Tab
    → Fetch staff list
    → Fetch existing preferences from `staff_early_shift_preferences`
    → Display in UI
    → User edits
    → Save to database
        → AI schedule generator reads on next generation
```

### AI Integration
```
AI Schedule Generation
    → Read calendar_rules (must_work, must_day_off)
    → Read staff_early_shift_preferences
    → Apply preferences when assigning △ shifts
        → Higher priority staff get more early shifts if they prefer
        → Avoid early shifts for staff who avoid them
        → Distribute fairly among neutral staff
```

---

## 6. Implementation Steps

### Phase 1: Database Setup
1. Create migration for `staff_early_shift_preferences` table
2. Add RLS policies for restaurant-scoped access
3. Test CRUD operations via Supabase

### Phase 2: UI Components
1. Create `EarlyShiftPreferencesTab.jsx` component
2. Create `CalendarPreview.jsx` (reuse calendar logic)
3. Create `StaffPreferenceRow.jsx` with dropdown and slider
4. Integrate tab into existing Settings modal

### Phase 3: Data Hooks
1. Create `useEarlyShiftPreferences.js` hook
   - `fetchPreferences(restaurantId)`
   - `savePreference(staffId, preference, priority)`
   - `bulkUpdatePreferences(preferences[])`
   - `resetPreferences(restaurantId)`

### Phase 4: Calendar Integration
1. Display read-only calendar in Settings tab
2. Highlight must_work (⚠️) and must_day_off (×) dates
3. Show date range (current month ± 1 month)

### Phase 5: AI Integration
1. Modify AI schedule generation algorithm
2. Read preferences from database
3. Apply weighted distribution for early shifts (△)
4. Test fairness and distribution

### Phase 6: Testing & Polish
1. Test preference saving/loading
2. Test AI respects preferences
3. Add loading states and error handling
4. Add success/error notifications

---

## 7. User Stories

### Story 1: View Calendar in Settings
**As a** manager
**I want to** see the monthly calendar rules in the Settings
**So that** I can reference must-work and must-off days while setting preferences

### Story 2: Set Early Shift Preference
**As a** manager
**I want to** mark specific staff as "prefer early shifts"
**So that** the AI assigns them more △ shifts

### Story 3: Avoid Early Shifts
**As a** manager
**I want to** mark certain staff as "avoid early shifts"
**So that** the AI assigns them fewer △ shifts (e.g., older staff)

### Story 4: Priority Weighting
**As a** manager
**I want to** set priority levels (0-100) for preferences
**So that** critical preferences are respected more strongly

### Story 5: Bulk Management
**As a** manager
**I want to** bulk edit multiple staff preferences
**So that** I can quickly configure new staff or change policies

---

## 8. Edge Cases & Considerations

### Edge Case 1: No Preferences Set
- **Scenario**: Manager hasn't set any preferences
- **Behavior**: AI distributes early shifts fairly among all staff (current behavior)

### Edge Case 2: All Staff Avoid Early Shifts
- **Scenario**: Manager marks everyone as "avoid"
- **Behavior**: Show warning, require at least some staff to accept early shifts

### Edge Case 3: Conflicting with Must-Work Days
- **Scenario**: Staff prefers early shifts but is on must-day-off
- **Behavior**: Calendar rules override preferences (must-day-off wins)

### Edge Case 4: Part-time Staff
- **Scenario**: Part-time staff with limited availability
- **Behavior**: Show part-time badge, factor in availability before applying preferences

### Edge Case 5: Restaurant Migration
- **Scenario**: Switching restaurants in the app
- **Behavior**: Load preferences specific to active restaurant

---

## 9. Technical Considerations

### Performance
- Cache preferences in React Query with 5-minute stale time
- Bulk update API to save multiple preferences at once
- Index on `restaurant_id` and `staff_id` for fast lookups

### Security
- RLS policies ensure managers only see their restaurant's data
- Validate preference values on backend (prefer/avoid/neutral)
- Validate priority range (0-100)

### Data Validation
```typescript
interface EarlyShiftPreference {
  staff_id: string;
  preference_type: 'prefer_early' | 'avoid_early' | 'neutral';
  priority: number; // 0-100
  notes?: string;
}
```

### Internationalization
- Japanese UI labels
- Tooltips explaining each preference type
- Help text for priority slider

---

## 10. Success Metrics

### Metrics to Track
1. **Adoption Rate**: % of restaurants using early shift preferences
2. **Fairness Score**: Standard deviation of early shift distribution
3. **Manager Satisfaction**: Survey rating after 1 month
4. **AI Compliance**: % of preferences respected by AI generator
5. **Edit Frequency**: How often managers change preferences

---

## 11. Future Enhancements

### V2 Features (Post-MVP)
1. **Historical Data**: Show past early shift distribution per staff
2. **Auto-Suggest**: AI suggests preferences based on past schedules
3. **Time-Based Preferences**: Different preferences for different months
4. **Shift Type Preferences**: Extend to late shifts (◇) and normal shifts (○)
5. **Staff Self-Service**: Allow staff to set their own preferences (pending approval)
6. **Analytics Dashboard**: Visual charts showing early shift distribution

---

## 12. Questions for Clarification

Before implementing, please confirm:

1. **Preference Scope**: Should preferences apply globally or per-period?
   - Option A: One preference for all future schedules
   - Option B: Different preferences for different periods

2. **AI Behavior**: How strongly should AI respect preferences?
   - Option A: Soft guidance (AI can override for fairness)
   - Option B: Hard rules (AI must respect unless impossible)

3. **Default Behavior**: What should be the default for new staff?
   - Option A: Neutral (no preference)
   - Option B: Manager must set explicitly

4. **Bulk Operations**: Should managers be able to:
   - Set all part-time staff to "avoid early"?
   - Copy preferences from previous period?

5. **Calendar Preview**: Should it show:
   - Current month only?
   - Current month ± 1 month? (3 months total)
   - Custom date range selector?

---

## 13. Next Steps

Once you approve this plan, I will:

1. ✅ Create the database migration
2. ✅ Implement UI components
3. ✅ Create data hooks
4. ✅ Integrate with Settings modal
5. ✅ Connect to AI schedule generator
6. ✅ Test and polish

**Estimated Development Time**: 4-6 hours

---

**Ready to proceed?** Please review and let me know:
- Any changes to the plan
- Answers to the clarification questions
- Priority of features (if we should implement in phases)
