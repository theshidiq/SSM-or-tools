# Analysis Framework: Qualitative Research on Shift Scheduling Systems

## Table of Contents
1. [Overview](#overview)
2. [Data Collection Guidelines](#data-collection-guidelines)
3. [Scoring and Metrics](#scoring-and-metrics)
4. [Analysis Methods](#analysis-methods)
5. [Interpretation Guide](#interpretation-guide)
6. [Reporting Templates](#reporting-templates)

---

## 1. Overview

### Purpose
This framework provides structured methods for analyzing qualitative data collected from the questionnaire comparing manual and AI-assisted shift scheduling systems.

### Research Questions
1. **Time Efficiency**: How much time does the AI system save?
2. **Accuracy**: Does the AI system reduce errors and constraint violations?
3. **Decision Support**: Does the AI improve decision-making quality?
4. **User Experience**: Is the AI system more usable than manual methods?
5. **Business Impact**: What is the ROI and staff satisfaction improvement?
6. **Future Readiness**: Will managers continue using AI systems?

---

## 2. Data Collection Guidelines

### Sample Size Recommendations
- **Minimum**: 5-10 managers for initial insights
- **Optimal**: 15-25 managers for statistical significance
- **Ideal**: 30+ managers for comprehensive analysis

### Interview Best Practices
1. **Timing**: Conduct after managers have used AI system for 3+ months
2. **Environment**: Quiet, private space without interruptions
3. **Duration**: Allow 45-60 minutes per interview
4. **Recording**: With permission, record audio for transcription
5. **Notes**: Take detailed notes on non-verbal cues and emphasis

### Data Collection Checklist
- [ ] Informed consent obtained
- [ ] Privacy notice provided
- [ ] Recording permission (if applicable)
- [ ] Questionnaire completed in full
- [ ] Follow-up questions asked for clarity
- [ ] Additional comments documented
- [ ] Thank you provided

---

## 3. Scoring and Metrics

### 3.1 Quantitative Metrics from Qualitative Data

#### Time Savings Calculation

```
Time Savings % = ((Manual Time - AI Time) / Manual Time) × 100

Example:
Manual: 210 minutes
AI: 13 minutes
Savings = ((210 - 13) / 210) × 100 = 93.8%
```

#### Satisfaction Score Calculation

```
Average Satisfaction = (Sum of all ratings) / (Number of questions)

Category Satisfaction = (Sum of category ratings) / (Number of category questions)

Example:
Q3.3 = 5, Q3.5 = 4, Q3.6 = 5
Quality Satisfaction = (5 + 4 + 5) / 3 = 4.67 / 5.00 = 93.3%
```

#### Net Promoter Score (NPS)

Based on Q7.4 (Recommendation likelihood):

```
NPS = % Promoters (4-5) - % Detractors (1-2)

Categories:
- Promoters: Rating 4-5 (Highly recommend, Recommend)
- Passives: Rating 3 (Neutral)
- Detractors: Rating 1-2 (Do not recommend, Definitely do not recommend)

Example:
15 respondents: 10 promoters, 3 passives, 2 detractors
NPS = (10/15 × 100) - (2/15 × 100) = 66.7 - 13.3 = 53.4
```

**NPS Interpretation:**
- Above 50: Excellent
- 30-50: Good
- 10-30: Average
- Below 10: Poor

### 3.2 Key Performance Indicators (KPIs)

| KPI | Calculation Method | Target |
|-----|-------------------|--------|
| **Time Efficiency** | Q2.1 vs Q2.2 comparison | 80%+ reduction |
| **Error Reduction** | Q3.1 vs Q3.2 comparison | 70%+ improvement |
| **Satisfaction Score** | Average of all rating questions | 4.0+ / 5.0 |
| **Trust in AI** | Q4.1 average | 4.0+ / 5.0 |
| **Usability** | Q5.2 average | 4.0+ / 5.0 |
| **Staff Satisfaction** | Q6.2 improvement % | 60%+ positive |
| **ROI Perception** | Q6.7 average | 4.0+ / 5.0 |
| **NPS** | Q7.4 calculation | 50+ |
| **Retention Intent** | Q7.5 "Yes" % | 80%+ |

---

## 4. Analysis Methods

### 4.1 Thematic Analysis

**Step 1: Data Familiarization**
- Read all questionnaire responses
- Note initial impressions and patterns
- Identify recurring themes

**Step 2: Initial Coding**
Create codes for common themes:

```
TIME_EFFICIENCY
  ├── CREATION_SPEED
  ├── CORRECTION_SPEED
  └── OVERALL_PRODUCTIVITY

ACCURACY
  ├── CONSTRAINT_COMPLIANCE
  ├── FAIRNESS_DISTRIBUTION
  └── ERROR_FREQUENCY

USER_EXPERIENCE
  ├── EASE_OF_USE
  ├── LEARNING_CURVE
  └── SYSTEM_PERFORMANCE

AI_CAPABILITIES
  ├── PATTERN_RECOGNITION
  ├── PREDICTIVE_ACCURACY
  └── OPTIMIZATION_QUALITY

BUSINESS_IMPACT
  ├── STAFF_SATISFACTION
  ├── OPERATIONAL_EFFICIENCY
  └── COST_BENEFIT
```

**Step 3: Theme Development**
- Group related codes into themes
- Define clear theme boundaries
- Create theme definitions

**Step 4: Review and Refine**
- Check theme coherence
- Ensure data supports themes
- Refine theme names

**Step 5: Define and Name**
- Write detailed theme descriptions
- Provide example quotes
- Relate to research questions

### 4.2 Comparative Analysis

**Manual vs AI System Comparison Matrix:**

| Dimension | Manual System | AI System | Improvement |
|-----------|--------------|-----------|-------------|
| Time (avg) | ___ min | ___ min | ___% |
| Errors (%) | ___% | ___% | ___% |
| Satisfaction | ___/5 | ___/5 | ___% |
| Fairness | ___/5 | ___/5 | ___% |
| Usability | ___/5 | ___/5 | ___% |

### 4.3 Sentiment Analysis

**Sentiment Coding for Open-Ended Responses:**

```
Positive (+): Expressions of satisfaction, improvement, benefits
Neutral (0): Factual statements, balanced views
Negative (-): Expressions of dissatisfaction, problems, challenges
```

**Example:**
- "AI saves me hours every week" → Positive
- "The system has some learning curve" → Neutral
- "I sometimes have to fix AI errors" → Negative

**Sentiment Score Calculation:**
```
Sentiment Score = (Positive - Negative) / Total Responses

Example:
20 positive, 3 neutral, 2 negative
Score = (20 - 2) / 25 = 0.72 (72% positive sentiment)
```

### 4.4 Statistical Summary

**Descriptive Statistics for Each Section:**

```python
# Example Python calculation
import numpy as np

section_2_ratings = [4, 5, 5, 4, 3, 5, 4, 5]

mean = np.mean(section_2_ratings)
median = np.median(section_2_ratings)
std_dev = np.std(section_2_ratings)
min_val = np.min(section_2_ratings)
max_val = np.max(section_2_ratings)

print(f"Mean: {mean:.2f}")
print(f"Median: {median}")
print(f"Std Dev: {std_dev:.2f}")
print(f"Range: {min_val}-{max_val}")
```

**Expected Output:**
```
Section 2: Time Efficiency
  Mean: 4.50 / 5.00 (90% satisfaction)
  Median: 4.5
  Std Dev: 0.76
  Range: 3-5
  Interpretation: High satisfaction with strong consensus
```

---

## 5. Interpretation Guide

### 5.1 Rating Scales Interpretation

**1-5 Likert Scale:**
- **1.00-1.99**: Very Poor - Major concerns, immediate action required
- **2.00-2.99**: Poor - Significant improvements needed
- **3.00-3.49**: Below Average - Some improvements needed
- **3.50-3.99**: Average - Minor improvements beneficial
- **4.00-4.49**: Good - Performing well
- **4.50-5.00**: Excellent - Exceeding expectations

**Standard Deviation Interpretation:**
- **< 0.5**: Very high consensus
- **0.5-1.0**: High consensus
- **1.0-1.5**: Moderate consensus
- **> 1.5**: Low consensus, diverse opinions

### 5.2 Pattern Recognition

**Look for these patterns:**

1. **Unanimous Praise**: All respondents rate 4-5
   - *Interpretation*: Clear strength, highlight in marketing

2. **Unanimous Criticism**: All respondents rate 1-2
   - *Interpretation*: Critical issue, prioritize fix

3. **Bimodal Distribution**: Ratings cluster at 1-2 and 4-5
   - *Interpretation*: Different user segments, investigate causes

4. **Improvement Trend**: Ratings increase with usage duration (Q1.5)
   - *Interpretation*: Learning curve exists, improve onboarding

### 5.3 Quote Selection Guidelines

**Select quotes that:**
- Represent majority opinion
- Provide specific examples
- Illustrate key themes
- Are concise and clear
- Include both positive and negative feedback

**Quote Format:**
```
"[Quote text]"
— Manager with 5 years experience, 20 staff members
  (Category: Time Efficiency, Sentiment: Positive)
```

**Example:**
```
"The AI system reduced my schedule creation time from 4 hours to 15 minutes.
I can now focus on staff development instead of drowning in spreadsheets."
— Restaurant Manager, 3 years experience, 25 staff
  (Category: Time Efficiency, Sentiment: Positive)
```

---

## 6. Reporting Templates

### 6.1 Executive Summary Template

```markdown
# Executive Summary: Shift Scheduling System Evaluation

## Overview
- **Survey Period**: [Date] to [Date]
- **Respondents**: [N] restaurant managers
- **Average Experience**: [X] years
- **Average Staff Size**: [Y] people

## Key Findings

### Time Efficiency
- **Time Savings**: [Z]% average reduction ([A] min → [B] min)
- **Satisfaction**: [C]/5.0 average rating
- **Quote**: "[Selected quote]"

### Accuracy and Quality
- **Error Reduction**: [D]% improvement ([E]% → [F]%)
- **Fairness Improvement**: [G]% ([H]/5 → [I]/5)
- **Trust in AI**: [J]/5.0 average rating

### Business Impact
- **Staff Satisfaction**: [K]% report improvement
- **ROI Rating**: [L]/5.0 average
- **Annual Time Saved**: [M] hours per manager
- **NPS Score**: [N] ([Interpretation])

### Overall Verdict
- **Recommendation Rate**: [O]% would recommend
- **Retention Intent**: [P]% want to continue using
- **Overall Satisfaction**: [Q]/5.0 average

## Recommendations
1. [Key recommendation 1]
2. [Key recommendation 2]
3. [Key recommendation 3]
```

### 6.2 Detailed Findings Template

```markdown
# Detailed Analysis: [Section Name]

## Quantitative Results

| Metric | Manual | AI | Improvement |
|--------|--------|-----|------------|
| [Metric 1] | [Value] | [Value] | [%] |
| [Metric 2] | [Value] | [Value] | [%] |

**Statistical Summary:**
- Mean: [X]/5.0
- Median: [Y]
- Std Dev: [Z]
- Range: [Min]-[Max]

## Qualitative Themes

### Theme 1: [Name]
**Description**: [1-2 sentences]

**Supporting Evidence**:
- Quote 1: "[...]" — [Source]
- Quote 2: "[...]" — [Source]

**Frequency**: Mentioned by [N]/[Total] respondents ([%])

**Sentiment**: [Positive/Neutral/Negative]

### Theme 2: [Name]
[Repeat structure]

## Interpretation
[2-3 paragraphs analyzing what the data means]

## Recommendations
1. [Specific action item]
2. [Specific action item]
```

### 6.3 Comparison Visualization Template

```markdown
## Visual Comparison: Manual vs AI System

### Time Efficiency Comparison
[Insert bar chart or table]

| Phase | Manual (min) | AI (min) | Savings (%) |
|-------|-------------|----------|------------|
| Data Collection | 30 | 2 | 93% |
| Schedule Creation | 60 | 3 | 95% |
| Constraint Check | 45 | 1 | 98% |
| Error Correction | 60 | 2 | 97% |
| **TOTAL** | **195** | **8** | **96%** |

### Satisfaction Ratings
[Insert radar chart or table]

| Dimension | Manual | AI | Improvement |
|-----------|--------|-----|------------|
| Usability | 3.2/5 | 4.6/5 | +44% |
| Accuracy | 2.8/5 | 4.7/5 | +68% |
| Time Efficiency | 2.5/5 | 4.8/5 | +92% |
| Decision Support | N/A | 4.5/5 | New |
```

### 6.4 Case Study Template

```markdown
# Case Study: [Manager Name/Pseudonym]

## Background
- **Position**: [Title]
- **Experience**: [Years]
- **Staff Size**: [Number]
- **Manual Experience**: [Duration]
- **AI Experience**: [Duration]

## Before AI System
[Describe challenges, time spent, pain points]

**Quote**: "[Manager's description of manual process]"

## After AI System
[Describe improvements, changes, benefits]

**Quote**: "[Manager's description of AI experience]"

## Measurable Impact
- Time Saved: [X] hours/week
- Error Reduction: [Y]%
- Staff Satisfaction: [Improvement description]
- Overall Rating: [Z]/5.0

## Key Takeaway
[1-2 sentences summarizing the transformation]
```

---

## 7. Action Items Based on Results

### 7.1 If Results Are Positive (4.0+ average)

**Marketing & Communication:**
- [ ] Create case studies from top quotes
- [ ] Develop ROI calculator for prospects
- [ ] Share success metrics on website
- [ ] Create video testimonials

**Product Development:**
- [ ] Identify most-loved features for enhancement
- [ ] Plan additional AI capabilities
- [ ] Improve onboarding based on feedback
- [ ] Add requested features from Q7.1

### 7.2 If Results Are Mixed (3.0-3.9 average)

**Investigation:**
- [ ] Conduct follow-up interviews with low scorers
- [ ] Identify specific pain points
- [ ] Analyze bimodal distributions
- [ ] Compare new vs. experienced users

**Improvement:**
- [ ] Address top 3 complaints
- [ ] Improve training materials
- [ ] Add missing features
- [ ] Optimize performance issues

### 7.3 If Results Are Poor (< 3.0 average)

**Urgent Actions:**
- [ ] Emergency user feedback sessions
- [ ] Root cause analysis
- [ ] Consider system redesign
- [ ] Evaluate rollback options
- [ ] Communicate improvement plan

---

## 8. Timeline for Analysis

**Week 1: Data Collection**
- Days 1-5: Conduct interviews
- Days 6-7: Data entry and organization

**Week 2: Initial Analysis**
- Days 1-2: Quantitative analysis (ratings, metrics)
- Days 3-4: Qualitative analysis (themes, quotes)
- Days 5-7: Cross-validation and synthesis

**Week 3: Reporting**
- Days 1-3: Draft executive summary
- Days 4-5: Create detailed findings report
- Days 6-7: Review and finalize

**Week 4: Action Planning**
- Days 1-3: Prioritize improvements
- Days 4-5: Create action plans
- Days 6-7: Present to stakeholders

---

## 9. Quality Assurance Checklist

**Data Quality:**
- [ ] All questionnaires complete (< 5% missing data)
- [ ] Consistent rating scale interpretation
- [ ] Open-ended responses transcribed accurately
- [ ] Demographic data recorded

**Analysis Quality:**
- [ ] Multiple coders for thematic analysis (inter-rater reliability)
- [ ] Quantitative calculations verified
- [ ] Quotes accurately attributed
- [ ] Themes supported by sufficient evidence (3+ quotes)

**Reporting Quality:**
- [ ] Executive summary clear and concise (2 pages max)
- [ ] Data visualizations accurate and labeled
- [ ] Recommendations actionable and prioritized
- [ ] Limitations acknowledged

---

## 10. Appendix: Sample Calculations

### Sample 1: Time Efficiency Analysis

**Data from 10 managers:**

| Manager | Manual (min) | AI (min) | Savings (min) | Savings (%) |
|---------|-------------|----------|---------------|-------------|
| M1 | 240 | 15 | 225 | 93.8% |
| M2 | 180 | 10 | 170 | 94.4% |
| M3 | 210 | 12 | 198 | 94.3% |
| M4 | 200 | 20 | 180 | 90.0% |
| M5 | 190 | 8 | 182 | 95.8% |
| M6 | 220 | 18 | 202 | 91.8% |
| M7 | 195 | 13 | 182 | 93.3% |
| M8 | 230 | 15 | 215 | 93.5% |
| M9 | 205 | 11 | 194 | 94.6% |
| M10 | 215 | 16 | 199 | 92.6% |

**Calculations:**
```
Average Manual Time = (240+180+...+215) / 10 = 208.5 min
Average AI Time = (15+10+...+16) / 10 = 13.8 min
Average Savings = 208.5 - 13.8 = 194.7 min (93.4%)

Annual Savings per Manager:
- Schedules per year: 12 periods
- Time saved per schedule: 194.7 min
- Annual savings: 194.7 × 12 = 2,336 min = 38.9 hours
```

### Sample 2: NPS Calculation

**Q7.4 Responses from 20 managers:**

| Rating | Count | Category |
|--------|-------|----------|
| 5 (Highly recommend) | 12 | Promoter |
| 4 (Recommend) | 5 | Promoter |
| 3 (Neutral) | 2 | Passive |
| 2 (Do not recommend) | 1 | Detractor |
| 1 (Definitely do not recommend) | 0 | Detractor |

**Calculation:**
```
Promoters = 12 + 5 = 17 (85%)
Passives = 2 (10%)
Detractors = 1 (5%)

NPS = 85% - 5% = 80

Interpretation: Excellent NPS score (80 is world-class)
```

---

## Conclusion

This framework provides comprehensive methods for analyzing qualitative research data on shift scheduling systems. Follow the guidelines systematically to:

1. **Collect** high-quality data through structured interviews
2. **Analyze** data using both quantitative and qualitative methods
3. **Interpret** findings with appropriate context
4. **Report** results clearly to stakeholders
5. **Act** on insights to improve systems and processes

**Remember**: The goal is not just to gather data, but to **generate actionable insights** that drive meaningful improvements in shift scheduling practices.

---

*Analysis Framework Version 1.0*
*Created: 2025-10-31*
*For use with: Shift Schedule Manager Research Project*
