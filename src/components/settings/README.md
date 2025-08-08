# Settings System

A comprehensive settings UI system for configuring ML model specifications and business rules in the React shift scheduling application.

## Overview

The settings system provides a tabbed interface for configuring various aspects of the shift scheduling algorithm, including staff groups, scheduling constraints, priority rules, ML parameters, and constraint weights.

## Features

### 🎛️ Tabbed Interface
- **Staff Groups**: Organize staff into groups with drag-and-drop functionality
- **Daily Limits**: Configure daily scheduling limits and constraints
- **Priority Rules**: Set up staff-specific preference rules
- **ML Parameters**: Configure machine learning algorithm parameters
- **Constraint Weights**: Fine-tune optimization weights with visualization

### 🔧 Core Functionality
- ✅ Real-time form validation with error display
- ✅ Save/Cancel/Reset functionality
- ✅ Import/Export configuration JSON
- ✅ Configuration versioning UI
- ✅ Change preview before applying
- ✅ Keyboard navigation support
- ✅ Responsive design for mobile/desktop

### 🎨 UI Components
- Custom sliders with color schemes
- Toggle switches with size variants
- Number inputs with increment/decrement controls
- Form fields with validation feedback
- Tab buttons with error indicators

## Architecture

```
src/components/settings/
├── SettingsModal.jsx           # Main modal container
├── index.js                    # Component exports
├── README.md                   # This file
├── shared/                     # Reusable UI components
│   ├── FormField.jsx
│   ├── NumberInput.jsx
│   ├── Slider.jsx
│   ├── TabButton.jsx
│   └── ToggleSwitch.jsx
└── tabs/                       # Tab-specific components
    ├── ConstraintWeightsTab.jsx
    ├── DailyLimitsTab.jsx
    ├── MLParametersTab.jsx
    ├── PriorityRulesTab.jsx
    └── StaffGroupsTab.jsx
```

## Usage

### Basic Integration

```jsx
import React, { useState } from 'react';
import { SettingsModal, useSettingsData } from './components/settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const {
    settings,
    updateSettings,
    saveSettings,
    isLoading,
    error,
    validationErrors,
    hasUnsavedChanges
  } = useSettingsData();

  return (
    <>
      <button onClick={() => setShowSettings(true)}>
        Settings ⚙️
      </button>
      
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={saveSettings}
        settings={settings}
        onSettingsChange={updateSettings}
        isLoading={isLoading}
        error={error}
        validationErrors={validationErrors}
        hasUnsavedChanges={hasUnsavedChanges}
      />
    </>
  );
}
```

### Custom Tab Component

```jsx
import React from 'react';
import { FormField, Slider, ToggleSwitch } from '../shared';

const CustomTab = ({ settings, onSettingsChange, validationErrors }) => {
  const updateSetting = (key, value) => {
    onSettingsChange({
      ...settings,
      [key]: value
    });
  };

  return (
    <div className="p-6 space-y-6">
      <FormField 
        label="Custom Setting"
        error={validationErrors.customSetting}
      >
        <Slider
          value={settings.customValue || 50}
          min={0}
          max={100}
          onChange={(value) => updateSetting('customValue', value)}
          colorScheme="blue"
        />
      </FormField>
      
      <ToggleSwitch
        label="Enable Feature"
        checked={settings.enableFeature || false}
        onChange={(checked) => updateSetting('enableFeature', checked)}
      />
    </div>
  );
};
```

## Data Structure

### Settings Configuration

```typescript
interface SettingsConfiguration {
  staffGroups: StaffGroup[];
  dailyLimits: DailyLimit[];
  monthlyLimits: MonthlyLimit[];
  priorityRules: PriorityRule[];
  conflictRules: ConflictRule[];
  mlParameters: MLParameters;
  constraintWeights: ConstraintWeights;
  penaltyMultipliers: PenaltyMultipliers;
  autoNormalizeWeights: boolean;
  dynamicWeightAdjustment: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}
```

### Staff Groups

```typescript
interface StaffGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  members: string[]; // Array of staff IDs
  coverageRules: {
    minimumCoverage: number;
    backupRequired: boolean;
    backupStaffIds: string[];
  };
}
```

### ML Parameters

```typescript
interface MLParameters {
  algorithm: 'genetic_algorithm' | 'simulated_annealing' | 'constraint_satisfaction';
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  elitismRate: number;
  convergenceThreshold: number;
  confidenceThreshold: number;
  maxRuntime: number;
  enableAdaptiveMutation: boolean;
  parallelProcessing: boolean;
}
```

## Database Integration

The settings system integrates with Supabase using the following tables:

- `config_versions` - Configuration versioning
- `staff_groups` - Staff group definitions
- `staff_group_members` - Group membership
- `daily_limits` - Daily scheduling constraints
- `monthly_limits` - Monthly scheduling constraints
- `priority_rules` - Staff preference rules
- `conflict_rules` - Conflict prevention rules
- `ml_model_configs` - ML algorithm configurations

## Validation

The system includes comprehensive validation:

```javascript
const validateSettings = (settings) => {
  const errors = {};
  
  // Validate staff groups
  if (settings.staffGroups) {
    const groupNames = settings.staffGroups.map(g => g.name);
    const duplicateNames = groupNames.filter((name, index) => 
      groupNames.indexOf(name) !== index
    );
    if (duplicateNames.length > 0) {
      errors['staff-groups'] = `Duplicate group names: ${duplicateNames.join(', ')}`;
    }
  }
  
  // Validate ML parameters
  if (settings.mlParameters) {
    const ml = settings.mlParameters;
    if (ml.populationSize < 10 || ml.populationSize > 1000) {
      errors.mlParameters = 'Population size must be between 10 and 1000';
    }
  }
  
  return errors;
};
```

## Keyboard Shortcuts

- **Escape**: Close modal
- **Ctrl/Cmd + S**: Save settings
- **Ctrl/Cmd + 1-5**: Switch between tabs
- **Arrow Keys**: Navigate form elements

## Accessibility

- Full keyboard navigation support
- ARIA labels and descriptions
- Screen reader compatibility
- Focus management in modal
- Color-blind friendly design
- High contrast support

## Customization

### Themes and Colors

The system supports multiple color schemes:

```jsx
<Slider
  colorScheme="blue"    // blue, green, purple, orange, red
  value={value}
  onChange={onChange}
/>
```

### Component Sizes

```jsx
<ToggleSwitch
  size="large"          // small, medium, large
  checked={checked}
  onChange={onChange}
/>

<NumberInput
  size="medium"         // small, medium, large
  value={value}
  onChange={onChange}
/>
```

## Performance Optimization

- Lazy loading of tab content
- Debounced form validation
- Memoized calculations for visualizations
- Efficient re-rendering with React.memo
- Virtual scrolling for large lists

## Testing

```javascript
// Example test for settings validation
import { validateSettings } from './useSettingsData';

describe('Settings Validation', () => {
  test('validates staff group names', () => {
    const settings = {
      staffGroups: [
        { id: '1', name: 'Kitchen' },
        { id: '2', name: 'Kitchen' }  // Duplicate
      ]
    };
    
    const errors = validateSettings(settings);
    expect(errors['staff-groups']).toContain('Duplicate group names');
  });
});
```

## Contributing

When adding new settings:

1. Update the `SettingsConfiguration` interface in `types/settings.d.ts`
2. Add validation logic in `useSettingsData.js`
3. Create UI components in the appropriate tab
4. Update database schema if needed
5. Add tests for new functionality

## Troubleshooting

### Common Issues

**Settings not saving**: Check database connection and table permissions
**Validation errors**: Ensure all required fields are filled
**Import/export failing**: Verify JSON format matches expected schema
**Performance issues**: Check for large datasets and enable pagination

### Debug Mode

Enable debug logging:

```javascript
localStorage.setItem('DEBUG_SETTINGS', 'true');
```

This will log validation errors, save operations, and state changes to the console.