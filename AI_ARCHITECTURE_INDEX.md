# AI Schedule Generation Architecture - Complete Documentation Index

## Overview

This directory contains comprehensive documentation of the shift-schedule-manager AI architecture for schedule generation. The system uses a sophisticated hybrid approach combining genetic algorithms, constraint satisfaction, and real-time Supabase integration.

## Documentation Files

### 1. **AI_ARCHITECTURE_ANALYSIS.md** (Main Document)
**Size**: ~22 KB | **Sections**: 14
- **Purpose**: Comprehensive technical analysis of the entire AI system
- **Covers**:
  - Main entry points and data flow
  - Calendar rules integration (current status)
  - Early shift preferences integration (current status)
  - Staff assignment logic
  - Complete data flow diagrams
  - Key files and functions (tables)
  - Current constraints (what's enforced vs. not)
  - Integration points for new features
  - Algorithm selection and parameters
  - Shift assignment logic by staff type
  - Pattern recognition system
  - Recommended implementation strategy
  - Implementation checklist

**Best For**: Deep understanding of the system, planning new features

### 2. **ARCHITECTURE_SUMMARY.md** (Quick Reference)
**Size**: ~6 KB | **Sections**: 12
- **Purpose**: Quick reference guide for developers
- **Covers**:
  - System overview
  - Critical files (entry points, algorithms, constraints)
  - Data flow (simplified)
  - Shift types (△, ○, ◇, ×)
  - Database table schemas
  - Constraint status (what's enforced)
  - ML algorithm parameters
  - Integration points (4 specific locations)
  - Testing checklist
  - Performance considerations
  - Deployment notes
  - Next steps

**Best For**: Quick lookup, daily development reference

### 3. **FILE_LOCATIONS.md** (Code Navigation Guide)
**Size**: ~10 KB | **Sections**: 15
- **Purpose**: Detailed file structure and line numbers
- **Covers**:
  - Core schedule generation files
  - Constraint processing modules
  - Algorithm implementations
  - Data access hooks (with line numbers)
  - UI components
  - Utility functions
  - Services
  - Database tables structure
  - Integration points with code locations
  - Configuration files
  - Test files
  - Performance/monitoring modules
  - Web workers
  - Debug utilities
  - Database relationship diagram

**Best For**: Finding specific code, navigation, implementation

### 4. **AI_ARCHITECTURE_INDEX.md** (This File)
**Purpose**: Navigation guide for all documentation

---

## Quick Start for Developers

### I need to...

#### Understand the system
→ Start with **ARCHITECTURE_SUMMARY.md** (5 min read)
→ Then read **AI_ARCHITECTURE_ANALYSIS.md** sections 1-5 (30 min)

#### Find a specific file
→ Use **FILE_LOCATIONS.md** with Ctrl+F search
→ Look for the filename or function name

#### Integrate early shift preferences
→ Read **AI_ARCHITECTURE_ANALYSIS.md** section 8
→ Check **FILE_LOCATIONS.md** for specific line numbers
→ Use **ARCHITECTURE_SUMMARY.md** section "Integration Points"

#### Understand constraints
→ Read **AI_ARCHITECTURE_ANALYSIS.md** section 7
→ Review **ARCHITECTURE_SUMMARY.md** "Current Constraint Status"

#### Work on algorithms
→ Check **FILE_LOCATIONS.md** "Algorithms" section
→ Read **ARCHITECTURE_SUMMARY.md** "ML Algorithm Parameters"

#### Add new constraint type
→ Read **AI_ARCHITECTURE_ANALYSIS.md** sections 2, 8-9
→ Check **FILE_LOCATIONS.md** "Integration Points"
→ Follow implementation checklist in **AI_ARCHITECTURE_ANALYSIS.md**

---

## Key Findings Summary

### Current System Status

**What's Implemented** ✅
- Genetic Algorithm (primary)
- Simulated Annealing (fallback)
- Ensemble approach (best quality)
- Staff group conflict constraints
- Daily shift limits
- Monthly fairness limits
- Priority rules (staff preferences)
- Pattern recognition (6 types)
- Real-time Supabase integration

**What's Loaded But Not Used** ⚠️
- Calendar rules (`calendar_rules` table) - loaded but NOT enforced
- Early shift preferences (`staff_early_shift_preferences` table) - loaded but NOT used in generation

**What's Missing** ❌
- Calendar rule constraint processor
- Early shift preference constraint processor
- Validation for calendar rules in output
- Validation for early shift preferences in output

### Architecture Highlights

```
Schedule Generation Flow:
Input → Configuration Load → Algorithm Select → 
Execute → Constraint Eval → Validate → Output

Critical Files:
- ScheduleGenerator.js (3,400+ lines)
- ConstraintEngine.js (1,100+ lines)
- ConstraintIntegrationLayer.js (1,120+ lines)
- PatternRecognizer.js (1,300+ lines)
- GeneticAlgorithm.js (1,200+ lines)

Data Sources (Real-time):
- useCalendarRules.js
- useEarlyShiftPreferences.js
- usePriorityRulesData.js
- useStaffGroupsData.js
```

---

## Feature Integration Roadmap

### Phase 1: Early Shift Preferences (HIGH IMPACT)
**Effort**: Medium | **Impact**: High
1. Load preferences in generateSchedule()
2. Create constraint processor
3. Add fitness penalties
4. Validate output
5. Test all algorithms

### Phase 2: Calendar Rules (HIGH IMPACT)
**Effort**: Medium | **Impact**: High
1. Load rules in generateSchedule()
2. Create constraint processor
3. Hard constraint enforcement
4. Validate 100% compliance
5. Test edge cases

### Phase 3: Pattern-Based Weighting (MEDIUM IMPACT)
**Effort**: High | **Impact**: Medium
1. Use PatternRecognizer output
2. Personalize constraint weights
3. Adapt per staff member
4. Feedback into algorithm

### Phase 4: Advanced Features (LOWER PRIORITY)
**Effort**: Very High | **Impact**: Low-Medium
1. Conflict prediction
2. Workload forecasting
3. Staff satisfaction scoring
4. ML model training

---

## Database Schema Highlights

### Primary Tables for Schedule Generation

```
calendar_rules
├─ restaurant_id
├─ date (YYYY-MM-DD)
├─ rule_type ('must_work' | 'must_day_off')
└─ reason

staff_early_shift_preferences
├─ restaurant_id
├─ staff_id
├─ can_do_early_shift (boolean)
├─ applies_to_date (specific or NULL)
└─ preference_source

staff_members
├─ id
├─ status ('社員' | 'パート')
└─ ... other fields

shift_schedules (generated output)
├─ staff_id
├─ date
└─ shift_type ('△' | '○' | '◇' | '×')
```

---

## Key Integration Points (4 Locations)

### 1. Configuration Loading
**File**: `src/ai/core/ScheduleGenerator.js` Line ~360-380
```javascript
const earlyShiftPreferences = await this.loadEarlyShiftPreferences(restaurantId);
const calendarRules = await this.loadCalendarRules(restaurantId, dateRange);
```

### 2. Constraint Processing
**File**: `src/ai/ml/ConstraintIntegrationLayer.js` Line ~262
```javascript
processedConstraints.earlyShiftConstraints = 
  this.processEarlyShiftConstraints(earlyShiftPreferences, context);
```

### 3. Fitness Evaluation
**File**: `src/ai/core/ScheduleGenerator.js` Fitness function
```javascript
fitnessScore -= this.countEarlyShiftViolations(solution) * penaltyWeight;
```

### 4. Solution Validation
**File**: `src/ai/constraints/ConstraintEngine.js` Line ~500+
```javascript
const earlyShiftValidation = this.validateEarlyShiftPreferences(schedule);
violations.push(...earlyShiftValidation);
```

---

## Algorithm Parameters

### Genetic Algorithm (Most Used)
```
quick:    population=50,   generations=150, mutation_rate=0.15
balanced: population=100,  generations=300, mutation_rate=0.1
best:     population=200,  generations=500, mutation_rate=0.05
```

### Fitness Scoring Weights
```
Hard Constraints:    50%
Soft Constraints:    30%
Objectives:          15%
Penalties:          -5%
```

---

## Staff Types and Shift Eligibility

### 社員 (Full-time Employee)
- Can work: △ (early), ○ (normal), ◇ (late), × (off)
- Special: Early shift capable
- Preferences: Tracked in `staff_early_shift_preferences`

### パート (Part-time Employee)
- Can work: ○ (normal), ◇ (late), × (off)
- Special: Cannot work early shifts
- Preferences: Tracked in `priority_rules`

---

## Performance Metrics

- **Algorithm Runtime**: 2-12 minutes (depending on staff count and algorithm)
- **Cache Duration**: 30 seconds (for configuration changes)
- **Concurrent Users**: 1000+ (via Go WebSocket server)
- **Population Size**: 50-200
- **Max Generations**: 150-500

---

## Testing Requirements

- [ ] Load calendar_rules successfully
- [ ] Load early_shift_preferences successfully
- [ ] Enforce must_work constraint
- [ ] Enforce must_day_off constraint
- [ ] Prevent △ to non-eligible staff
- [ ] Penalize △ to non-preference staff
- [ ] Validate all constraints before return
- [ ] Handle missing/empty preferences
- [ ] Test with all algorithms
- [ ] Performance test with large datasets

---

## Related Project Documentation

- `CLAUDE.md` - Project guidelines and development commands
- `WORKING_CALENDAR_PLAN.md` - Calendar feature requirements
- `WORKING_CALENDAR_WIREFRAMES.md` - UI mockups
- `AGENTS.md` - AI agents and automation
- `.claude/mcp.json` - MCP configuration

---

## Version History

- **2025-11-21**: Complete architecture analysis created
  - 3 comprehensive documents totaling ~38 KB
  - 14 detailed sections in main analysis
  - 4 specific integration points identified
  - Implementation checklist provided

---

## Contact & Support

For questions about this documentation:
1. Check the specific document covering your question
2. Use FILE_LOCATIONS.md to find relevant code
3. See ARCHITECTURE_SUMMARY.md for quick answers
4. Refer to AI_ARCHITECTURE_ANALYSIS.md for deep dives

---

## License & Attribution

This documentation is part of the shift-schedule-manager project.
Generated: November 21, 2025

Generated with Claude Code
