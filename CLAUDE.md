# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- `npm start` or `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Create production build
- `npm run build:production` - Create optimized production build with NODE_ENV=production
- `npm test` - Run tests in interactive watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode with coverage

### Code Quality
- `npm run lint` - Run ESLint on src/ directory
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run validate` - Run both linting and test coverage

### Deployment & Analysis
- `npm run analyze` - Analyze bundle size with webpack-bundle-analyzer
- `npm run build:analyze` - Build and analyze bundle
- `npm run preview` - Build and serve production build locally
- `npm run security-check` - Run npm audit for security issues

## Architecture Overview

### Core Technology Stack
- **React 18** with functional components and hooks
- **React Query (@tanstack/react-query)** for server state management
- **Supabase** for database operations and real-time data
- **Tailwind CSS** for styling
- **Date-fns** for date manipulation with Japanese locale support

### Application Structure

#### Main Components
- `ShiftScheduleEditor.jsx` - Main application component that orchestrates all functionality
- `ScheduleTable.jsx` - Interactive table for shift editing with keyboard navigation
- `NavigationToolbar.jsx` - Period navigation and bulk operations
- `StatisticsDashboard.jsx` - Analytics and reporting interface
- `StaffEditModal.jsx` - Staff member management interface

#### Data Management Architecture
The app uses a hybrid local/remote storage approach:

1. **Local Storage**: Primary data storage using localStorage with automatic migration
2. **Supabase Integration**: Optional cloud sync for data persistence and collaboration
3. **React Query**: Caching layer for Supabase operations with 5-minute stale time

#### Key Data Structures
- **Schedule Data**: `{ [staffId]: { [dateString]: shiftSymbol } }`
- **Staff Members**: Objects with id, name, position, department, type (regular/part-time)
- **Monthly Periods**: 6 predefined periods from January-February through November-December

### Custom Hooks

#### `useScheduleData()`
- Manages schedule state with automatic localStorage persistence
- Handles data migration between versions
- Provides methods for schedule manipulation and export
- Integrates with Supabase for cloud sync

#### `useStaffManagement()`
- Handles staff member CRUD operations
- Manages staff ordering and filtering
- Supports both regular and part-time staff types

#### `useSupabase()`
- Manages Supabase connection and operations
- Provides real-time sync capabilities
- Handles connection status and error states

### Shift Management System

#### Shift Types
- `△` (sankaku) - Early shift
- `○` (maru) - Normal shift  
- `▽` (sakasa-sankaku) - Late shift
- `×` (batsu) - Day off
- Custom text values for special cases

#### Date Range Management
- Uses 6 predefined monthly periods (Jan-Feb through Nov-Dec)
- Japanese date formatting with date-fns/locale/ja
- Automatic period navigation and validation

### Export & Integration Features

#### Export Formats
- **CSV**: Excel-compatible with Japanese encoding
- **TSV**: Tab-separated for Google Sheets
- **Print**: Formatted PDF-style printing
- **Supabase**: Direct cloud database sync

#### Google Sheets Integration
- Uses Google Apps Script for bi-directional sync
- Configurable via environment variables
- Handles authentication and error recovery

## Environment Configuration

### Required Environment Variables
```env
# Supabase (optional - app works without)
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Sheets (optional)
REACT_APP_GOOGLE_SHEETS_API_KEY=your_api_key
REACT_APP_GOOGLE_APPS_SCRIPT_URL=your_script_url
```

### Data Migration Strategy
The app automatically migrates data between versions:
- Staff member structure changes
- Schedule format updates  
- New feature additions
- Migration logs to console for debugging

### Testing Guidelines
- Components use React Testing Library
- 80% coverage threshold for branches, functions, lines, statements
- Tests focus on user interactions and data flows
- Mock Supabase and localStorage in tests

### Performance Considerations
- React Query caching reduces API calls
- Memoized components prevent unnecessary re-renders
- Debounced localStorage saves
- Virtual scrolling for large datasets
- Bundle analysis available via `npm run analyze`

### Japanese Localization
- Date formatting uses ja locale from date-fns
- Staff names and positions support Japanese characters
- Shift symbols use Japanese geometric characters
- UI labels are in Japanese for restaurant context

### Browser Compatibility
- Modern browsers with ES2020 support
- Chrome >= 88, Firefox >= 85, Safari >= 14, Edge >= 88
- Mobile responsive with touch-friendly interfaces
- Minimum 44px touch targets for accessibility