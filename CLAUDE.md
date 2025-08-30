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
The app uses a **Supabase-first real-time architecture** (Phase 3 complete):

1. **Supabase Real-time**: Primary data storage with live collaboration across users
2. **Multi-layer Caching**: Memory cache with LRU eviction + IndexedDB persistence
3. **Offline-first Support**: Complete offline operation with automatic synchronization
4. **Conflict Resolution**: Multiple strategies (Last Writer Wins, First Writer Wins, Merge, User Choice)
5. **React Query**: Advanced caching layer with 5-second stale time for real-time responsiveness

#### Key Data Structures
- **Schedule Data**: `{ [staffId]: { [dateString]: shiftSymbol } }`
- **Staff Members**: Objects with id, name, position, department, type (regular/part-time)
- **Monthly Periods**: 6 predefined periods from January-February through November-December

### Custom Hooks (Phase 3 Enhanced)

#### **Primary Hooks (Enhanced Architecture)**
- `useScheduleDataEnhanced()` - Phase 1+2+3 features with Supabase-first real-time
- `useStaffManagementEnhanced()` - Phase 2+3 real-time staff operations with advanced caching
- `useSettingsDataEnhanced()` - Phase 2+3 real-time settings with conflict resolution

#### **Real-time Core Hooks**
- `useScheduleDataRealtime()` - Supabase-first schedule management with live collaboration
- `useStaffManagementRealtime()` - Period-based staff CRUD with real-time updates
- `useSettingsDataRealtime()` - JSONB-based settings storage with live sync

#### **Advanced Feature Hooks (Phase 2)**
- `useAdvancedCache()` - Multi-layer caching with LRU eviction and IndexedDB
- `useOfflineOperations()` - Queue-based offline support with auto-sync
- `useConflictResolution()` - Sophisticated conflict handling strategies
- `useSupabase()` - Connection management and real-time subscriptions

### Shift Management System

#### Shift Types
- `△` (sankaku) - Early shift
- `○` (maru) - Normal shift  
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


## Environment Configuration

### Required Environment Variables
```env
# Supabase (optional - app works without)
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key


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
- **Real-time Optimization**: 5-second stale time for immediate responsiveness
- **Multi-layer Caching**: Memory cache + IndexedDB for offline performance
- **Bundle Size**: 411kB gzipped main bundle (optimization pending with lazy loading)
- **AI Features**: 2.8MB AI modules ready for lazy loading implementation
- **React Query**: Advanced caching reduces API calls with optimistic updates
- **Memoized Components**: Prevent unnecessary re-renders
- **Conflict Resolution**: Efficient merge algorithms minimize data loss
- **Bundle Analysis**: Available via `npm run analyze`

#### **Bundle Optimization Plan**
- **Current State**: All AI features loaded upfront (411kB main bundle)
- **Target State**: Lazy load AI features on-demand (~150-200kB main bundle)
- **Expected Improvement**: 60% bundle size reduction, instant app startup

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

## Code Writing Guidelines (Context7 Enhanced)

### React Lazy Loading Implementation
When implementing lazy loading for performance optimization:

```javascript
import { lazy, Suspense } from 'react';

// ✅ Declare lazy components at top level (outside components)
const AdvancedIntelligence = lazy(() => import('./ai/AdvancedIntelligence'));
const AutonomousEngine = lazy(() => import('./ai/AutonomousEngine'));

function App() {
  const [showAI, setShowAI] = useState(false);
  
  return (
    <div>
      {/* Core functionality loads immediately */}
      <ScheduleTable />
      
      <button onClick={() => setShowAI(true)}>
        Enable AI Features
      </button>
      
      {showAI && (
        <Suspense fallback={<div>Loading AI...</div>}>
          <AdvancedIntelligence />
        </Suspense>
      )}
    </div>
  );
}
```

### Component Structure Best Practices
- **Declare lazy components outside of render functions** to prevent state resets
- **Use Suspense boundaries** for graceful loading states
- **Group related components** under single Suspense for coordinated loading
- **Provide meaningful fallback UI** during component loading

### Performance Optimization Patterns
- **Progressive Loading**: Load core functionality first, optional features on-demand
- **Code Splitting**: Use dynamic imports for heavy features (AI, ML, analytics)
- **Bundle Analysis**: Regular monitoring with `npm run analyze`
- **Lazy Initialization**: Defer expensive computations until needed

### Real-time Architecture Guidelines
- **Supabase-first**: All data operations go through Supabase real-time hooks
- **Optimistic Updates**: Update UI immediately, sync with database
- **Conflict Resolution**: Handle concurrent edits gracefully
- **Offline Support**: Queue operations when offline, sync when reconnected