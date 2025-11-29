# Files to Fix: ○ Symbol Bug

## Analysis Documents (Created)

1. **Main Analysis** (28 KB - comprehensive)
   ```
   /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/CRITICAL_BUG_ANALYSIS_REGULAR_STAFF_GETTING_MARU.md
   ```

2. **Quick Summary** (1.8 KB - for quick reference)
   ```
   /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/BUG_FIX_SUMMARY.md
   ```

3. **Data Flow Diagram** (visual ASCII)
   ```
   /Users/kamalashidiq/Documents/Apps/shift-schedule-manager/SYMBOL_ASSIGNMENT_FLOW.txt
   ```

---

## Files to Fix (Priority Order)

### CRITICAL PRIORITY - FIX IMMEDIATELY

#### 1. GeneticAlgorithm.js (PRIMARY CULPRIT)
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/algorithms/GeneticAlgorithm.js
```

**Lines to Fix:**
- Line 488: `shift = "○"` → `shift = getNormalShift(staff)`
- Line 502: `... "○"` → `... getNormalShift(staff)`
- Line 504: `... "○"` → `... getNormalShift(staff)`
- Line 515: `shift = "○"` → `shift = getNormalShift(staff)`
- Line 526: `|| "○"` → `|| getNormalShift(staff)`
- Line 537: `shift = "○"` → `shift = getNormalShift(staff)`
- Line 543: `shift = "○"` → `shift = getNormalShift(staff)`
- Line 596: `= "○"` → `= normalShift` (with `const normalShift = getNormalShift(staff)`)
- Line 609: `= "○"` → `= normalShift`
- Line 619: `= "○"` → `= normalShift`
- Line 624: `= "○"` → `= normalShift`

**Total:** 11 locations

---

### HIGH PRIORITY - FIX WITHIN 2 DAYS

#### 2. StreamingResultsManager.js
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/performance/StreamingResultsManager.js
```

**Lines to Fix:**
- Line 468: `let bestShift = "○"` → `let bestShift = staff.status === "パート" ? "○" : ""`
- Line 906: `shift: "○"` → `shift: staff.status === "パート" ? "○" : ""`
- Line 449: Review probability assignment logic

**Total:** 3 locations

#### 3. FallbackMLProcessor.js
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/performance/FallbackMLProcessor.js
```

**Lines to Fix:**
- Line 539: `let bestShift = "○"` → `let bestShift = staff.status === "パート" ? "○" : ""`
- Line 600: `suggestedFix: "○"` → `suggestedFix: staff.status === "パート" ? "○" : ""`
- Line 618: `suggestedFix: "○"` → `suggestedFix: staff.status === "パート" ? "○" : ""`
- Line 520: Review probability assignment logic

**Total:** 4 locations

---

### MEDIUM PRIORITY - FIX WITHIN 3-4 DAYS

#### 4. TensorFlowScheduler.js
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/ml/TensorFlowScheduler.js
```

**Lines to Fix:**
- Line 1733: `return "○"` → `return staff.status === "パート" ? "○" : ""`
- Line 1734: `return "○"` → `return staff.status === "パート" ? "○" : ""`
- Line 1741: `return "○"` → `return staff.status === "パート" ? "○" : ""`
- Line 1749: `return "○"` → `return staff.status === "パート" ? "○" : ""`
- Line 1757: `return "○"` → `return staff.status === "パート" ? "○" : ""`
- Line 1761-1763: Fix multiple `"○"` assignments

**Total:** 10+ locations

#### 5. MLEngine.js
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/advanced/MLEngine.js
```

**Lines to Fix:**
- Line 607: `schedule[staff.id][dateKey] = "○"` → Check staff.status first

**Total:** 1 location

---

### LOW PRIORITY - FIX WITHIN 5-7 DAYS

#### 6. SeasonalAnalyzer.js
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/advanced/SeasonalAnalyzer.js
```

**Lines to Fix:**
- Line 1090: `staffSchedule[dateKey] = "○"` → Check staff.status first

**Total:** 1 location

---

## Files with CORRECT Logic (Reference Only)

These files already handle ○ correctly - use as examples:

#### HybridPredictor.js ✅
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/hybrid/HybridPredictor.js
```

**Correct Usage:**
- Line 1561: `staffProfile?.status === "社員" ? "" : "○"`
- Line 1618: `staffProfile.status === "社員" ? "" : "○"`
- Line 1640: `staffProfile.status === "社員" ? "" : "○"`
- Line 1646: `staffProfile.status === "社員" ? "" : "○"`

#### WorkerManager.js ✅
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/performance/WorkerManager.js
```

**Correct Usage:**
- Line 529-531: `if (staff.status === "パート") { shift = "○"; }`

#### ScheduleGenerator.js ✅
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/core/ScheduleGenerator.js
```

**Correct Usage:**
- Line 2733: `staff.status === "パート" ? "○" : ""`

---

## New Files to Create

### 1. ShiftSymbolValidator.js (Validation Utility)
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/utils/ShiftSymbolValidator.js
```

**Purpose:** Validate and auto-correct shift symbol assignments

**Features:**
- `validateShiftForStaff(staff, shift)` - Single shift validation
- `validateSchedule(schedule, staffMembers)` - Full schedule validation
- `getNormalShiftForStaff(staff)` - Helper to get correct normal shift

### 2. Unit Tests for Validator
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/utils/__tests__/ShiftSymbolValidator.test.js
```

### 3. Integration Tests for GeneticAlgorithm
**Path:**
```
/Users/kamalashidiq/Documents/Apps/shift-schedule-manager/src/ai/algorithms/__tests__/GeneticAlgorithm.symbolCorrectness.test.js
```

---

## Command Reference

### Read a file for fixing
```bash
# Read GeneticAlgorithm.js around line 480-543
cat -n src/ai/algorithms/GeneticAlgorithm.js | sed -n '480,543p'

# Read repair function around line 578-627
cat -n src/ai/algorithms/GeneticAlgorithm.js | sed -n '578,627p'
```

### Search for ○ assignments
```bash
# Find all ○ assignments in a file
grep -n '"○"' src/ai/algorithms/GeneticAlgorithm.js

# Find all files with ○ in src/ai
find src/ai -name "*.js" -exec grep -l '"○"' {} \;
```

### Run tests after fixing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- ShiftSymbolValidator.test.js

# Run with coverage
npm run test:coverage
```

---

## Fix Progress Tracking

### Phase 1: Emergency Hotfix ⏳
- [ ] Fix GeneticAlgorithm.js (11 lines)
- [ ] Create ShiftSymbolValidator.js
- [ ] Add post-generation validation
- [ ] Test with real data
- [ ] Verify: 安井, 古藤, 小池 have NO ○

### Phase 2: Comprehensive Fixes ⏳
- [ ] Fix StreamingResultsManager.js (3 lines)
- [ ] Fix FallbackMLProcessor.js (4 lines)
- [ ] Fix TensorFlowScheduler.js (10+ lines)
- [ ] Fix MLEngine.js (1 line)
- [ ] Fix SeasonalAnalyzer.js (1 line)

### Phase 3: Prevention Layer ⏳
- [ ] Create ShiftSymbolValidator.js utility
- [ ] Add unit tests for validator
- [ ] Add integration tests for GeneticAlgorithm
- [ ] Add E2E tests with Chrome MCP
- [ ] Add UI validation layer

### Phase 4: Documentation ⏳
- [ ] Update CLAUDE.md with shift symbol rules
- [ ] Add JSDoc to all ○ assignments
- [ ] Create developer guide
- [ ] Document prevention strategy

---

## Quick Test Command

```bash
# After fixing, run this to verify
npm test -- --testPathPattern="GeneticAlgorithm" --verbose

# Or test specific staff member
npm test -- --testNamePattern="should never assign ○ to 社員"
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b fix/critical-regular-staff-maru-symbol

# Stage files as you fix them
git add src/ai/algorithms/GeneticAlgorithm.js
git add src/ai/utils/ShiftSymbolValidator.js

# Commit with clear message
git commit -m "FIX: Prevent ○ symbol assignment to 社員 staff in GeneticAlgorithm"

# Push to remote
git push origin fix/critical-regular-staff-maru-symbol
```

---

**Last Updated:** 2025-11-29
**Status:** Ready for implementation
**Priority:** CRITICAL
