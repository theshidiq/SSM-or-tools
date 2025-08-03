# AI Shift Prediction Model Specification

## Overview
This document defines the business rules, constraints, and considerations for the AI-powered shift prediction model in the Shift Schedule Manager application. The model aims to automatically generate optimal shift schedules based on historical patterns while respecting operational constraints and staff preferences.

## Version Information
- **Version**: 1.0
- **Created**: August 2025
- **Last Updated**: August 2025
- **Status**: Initial Specification

---

## Core Principles

### 1. Data Preservation
- **Respect Existing Data**: If user has already filled data for a new month period, the AI should skip filled cells and only predict/fill empty cells
- **Non-Destructive**: Never overwrite manually entered shift data
- **Incremental Filling**: Support partial schedule completion

### 2. Workload Balance
- **Fair Distribution**: Ensure equitable distribution of shifts across all staff members
- **Sustainable Scheduling**: Prevent excessive workload on individual staff members
- **Pattern Recognition**: Learn from historical data to understand preferred work patterns

---

## Business Constraints

### 1. Monthly Day-Off Limits
- **31-Day Months**: Maximum 8 days off per staff member
- **30-Day Months**: Maximum 7 days off per staff member
- **29-Day Months**: Maximum 7 days off per staff member  
- **28-Day Months**: Maximum 6 days off per staff member

### 2. Daily Coverage Constraints
- **Maximum Staff Off/Early Per Day**: 3-4 staff members maximum can have day off OR early shift on the same day
- **Minimum Coverage**: Ensure adequate staffing levels are maintained daily
- **Peak vs. Regular Days**: Consider different requirements for busy/slow days

---

## Staff Group Restrictions

### Group Definitions
The following staff members are organized into groups that cannot have simultaneous day offs or early shifts:

#### Group 1: Senior Kitchen Staff
- **Members**: 料理長 (Head Chef), 古藤 (Furuto)
- **Restriction**: Cannot both have day off or early shift on the same day
- **Priority**: Critical coverage group

#### Group 2: Kitchen Support A
- **Members**: 井関 (Iseki), 小池 (Koike)
- **Restriction**: Cannot both have day off or early shift on the same day

#### Group 3: Kitchen Support B  
- **Members**: 田辺 (Tanabe), 小池 (Koike)
- **Restriction**: Cannot both have day off or early shift on the same day
- **Note**: 小池 appears in multiple groups - extra caution needed

#### Group 4: Service Staff A
- **Members**: 与儀 (Yogi), カマル (Kamal)
- **Restriction**: Cannot both have day off or early shift on the same day

#### Group 5: Service Staff B
- **Members**: カマル (Kamal), 高野 (Takano)  
- **Restriction**: Cannot both have day off or early shift on the same day
- **Note**: カマル appears in multiple groups - extra caution needed

#### Group 6: Support & Temporary Staff
- **Members**: 高野 (Takano), 派遣スタッフ (Temporary Staff)
- **Restriction**: Cannot both have day off or early shift on the same day

### Multi-Group Staff Considerations
- **小池 (Koike)**: Appears in Groups 2 and 3 - requires careful scheduling
- **カマル (Kamal)**: Appears in Groups 4 and 5 - requires careful scheduling  
- **高野 (Takano)**: Appears in Groups 5 and 6 - requires careful scheduling

---

## Priority Rules

### 1. Sunday Preferences

#### High Priority: 料理長 (Head Chef) Early Shift
- **Rule**: Prioritize scheduling 料理長 for early shift (△) on Sundays
- **Rationale**: Senior staff oversight during typically busy Sunday service
- **Flexibility**: Can be overridden if critical conflicts arise

#### High Priority: 与儀 (Yogi) Day Off  
- **Rule**: Prioritize scheduling 与儀 for day off (×) on Sundays
- **Rationale**: Staff work-life balance consideration
- **Flexibility**: Can be adjusted based on coverage needs

### 2. Conflict Resolution Priority Order
1. **Group Restrictions** (highest priority)
2. **Daily Coverage Limits**
3. **Monthly Day-Off Limits**
4. **Sunday Preferences**
5. **Historical Patterns** (lowest priority)

---

## AI Model Considerations

### 1. Pattern Recognition
- **Historical Analysis**: Learn from previous month patterns
- **Staff Preferences**: Identify preferred days/shifts for each staff member
- **Seasonal Variations**: Account for different patterns during different months
- **Day-of-Week Patterns**: Recognize different staffing needs per day of week

### 2. Optimization Goals
- **Primary**: Meet all hard constraints (group restrictions, coverage limits)
- **Secondary**: Satisfy priority rules (Sunday preferences)
- **Tertiary**: Optimize for fairness and staff satisfaction
- **Quaternary**: Maintain historical pattern consistency where beneficial

### 3. Machine Learning Approach
- **Constraint Satisfaction Problem (CSP)**: Use CSP solver for hard constraints
- **Pattern Recognition**: ML model to identify optimal patterns
- **Genetic Algorithm**: For complex optimization scenarios
- **Reinforcement Learning**: Learn from user corrections and feedback

---

## Implementation Guidelines

### 1. Data Input Requirements
- **Historical Schedule Data**: Minimum 3 months of data for pattern recognition
- **Staff Information**: Names, positions, employment type (社員/派遣/パート)
- **Group Memberships**: Current group assignments for each staff member
- **Existing Schedule Data**: Any pre-filled data for the target month

### 2. Validation Rules
- **Pre-Generation Validation**: Check all constraints before generating schedule
- **Post-Generation Validation**: Verify generated schedule meets all requirements
- **User Override Capability**: Allow manual adjustments with constraint warnings
- **Real-time Validation**: Immediate feedback when constraints are violated

### 3. User Interface Considerations
- **Confidence Indicators**: Show AI confidence level for each prediction
- **Constraint Violation Warnings**: Clear visual feedback for rule conflicts
- **Manual Override Options**: Easy way to accept/reject AI suggestions
- **Explanation Feature**: Show why specific assignments were made

---

## Future Considerations

### 1. Dynamic Group Management
- **Flexible Group Definitions**: Allow users to modify group memberships
- **Temporary Group Changes**: Handle sick leave, vacation, new hires
- **Role-Based Groups**: Automatic grouping based on job roles/skills

### 2. Advanced Features
- **What-If Analysis**: Test different scenarios before committing
- **Optimization Metrics**: Show fairness scores, coverage efficiency
- **Integration with HR Systems**: Pull staff availability, vacation requests
- **Mobile Notifications**: Alert staff about schedule changes

### 3. Learning and Adaptation
- **User Feedback Loop**: Learn from manual corrections and preferences  
- **Performance Metrics**: Track prediction accuracy and user satisfaction
- **Continuous Improvement**: Regular model retraining with new data
- **A/B Testing**: Test different prediction strategies

---

## Technical Notes

### 1. Constraint Representation
```javascript
// Example constraint structure
const constraints = {
  monthlyDayOffLimits: {
    31: 8, 30: 7, 29: 7, 28: 6
  },
  dailyLimits: {
    maxOffOrEarly: 4
  },
  groups: [
    { name: "Group1", members: ["料理長", "古藤"], restriction: "no_simultaneous_off_early" },
    // ... other groups
  ],
  priorities: [
    { staff: "料理長", day: "sunday", shift: "early", weight: 0.8 },
    { staff: "与儀", day: "sunday", shift: "off", weight: 0.8 }
  ]
};
```

### 2. Data Structures
- **Schedule Matrix**: 2D array [staff][date] = shift_type
- **Constraint Graph**: Relationships between staff, groups, and restrictions  
- **Pattern History**: Time-series data of previous schedules
- **Preference Model**: Learned preferences for each staff member

---

## Changelog

### Version 1.0 (August 2025)
- Initial specification document
- Defined core business rules and constraints
- Established group restrictions and priority rules
- Outlined AI model approach and implementation guidelines

---

## Approval & Review

- **Document Owner**: Shift Schedule Manager Development Team
- **Business Stakeholder**: Restaurant Management  
- **Technical Review**: AI/ML Development Team
- **Next Review Date**: September 2025

---

*This document serves as the authoritative specification for AI prediction model development. Any changes to business rules or constraints should be documented here with appropriate version updates.*