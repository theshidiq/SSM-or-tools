# Agent Code Review Instructions

This file contains instructions for AI coding agents working on the shift-schedule-manager project. After making any code changes, the agent should call the `review_code` tool with the following information:

## Review Parameters

When calling `review_code`, provide:

- **user_instructions**: The exact directions provided by the user
- **agent_plan**: A detailed summary of the modifications including:
  - Files changed
  - Specific additions/modifications made
  - Implementation approach and reasoning
- **project_path**: `/Users/kamalashidiq/Documents/Apps/shift-schedule-manager`

## Project-Specific Review Guidelines

### Architecture Standards

1. **Hybrid Go + WebSocket + Supabase Architecture**
   - All staff operations should use WebSocket communication with the Go server
   - Server-authoritative state management is required
   - Supabase is for data persistence and complex queries only
   - Real-time updates must be driven by WebSocket events

2. **React Component Standards**
   - Use functional components with hooks only
   - Lazy load heavy features (AI, ML, analytics) for performance
   - Declare lazy components at top level, outside render functions
   - Use Suspense boundaries with meaningful fallback UI

3. **Performance Requirements**
   - Staff update latency must be <50ms
   - WebSocket response times must be sub-100ms
   - Support 1000+ concurrent connections
   - Bundle size must be optimized through code splitting

### Code Quality Checks

1. **Security**
   - Prevent command injection, XSS, SQL injection
   - Follow OWASP top 10 guidelines
   - Validate all user inputs
   - Sanitize data before rendering

2. **Japanese Localization**
   - Use date-fns with ja locale for date formatting
   - Support Japanese characters in staff names and positions
   - Maintain Japanese shift symbols (△, ○, ◇, ×)
   - Ensure UI labels are in Japanese where appropriate

3. **Testing**
   - Unit tests with React Testing Library
   - 80% coverage threshold for branches, functions, lines, statements
   - Integration tests for WebSocket functionality
   - E2E tests using Chrome MCP

4. **Production Logging**
   - Keep console output minimal in production
   - Preserve all error logging for debugging
   - Remove verbose debug output from production builds
   - Use conditional logging with NODE_ENV checks

### Common Issues to Flag

1. **Race Conditions**
   - Direct Supabase mutations without WebSocket coordination
   - Client-side state updates that bypass the Go server
   - Missing conflict resolution for concurrent edits

2. **Performance Anti-patterns**
   - Eager loading of AI/ML features
   - Missing lazy loading for optional components
   - Inefficient data fetching without React Query caching
   - Large bundle sizes without code splitting

3. **Architecture Violations**
   - Bypassing the WebSocket server for staff operations
   - Direct database access from client components
   - Missing real-time event subscriptions
   - Improper fallback handling for connection failures

4. **Code Style Issues**
   - Console.log statements in production code
   - Missing error boundaries
   - Incomplete TypeScript types
   - Unused imports or dependencies

### Testing Requirements

Before approving code changes, verify:

- [ ] All modified components have unit tests
- [ ] WebSocket integration tests pass
- [ ] No new console warnings or errors
- [ ] Bundle size impact is acceptable
- [ ] Japanese localization works correctly
- [ ] Real-time synchronization is functional
- [ ] Error handling is comprehensive
- [ ] Performance metrics meet requirements

### Development Workflow

1. **Before Making Changes**
   - Understand the hybrid architecture
   - Check existing patterns in the codebase
   - Review CLAUDE.md for development guidelines

2. **During Development**
   - Follow React best practices
   - Use WebSocket-first approach
   - Implement proper error handling
   - Add comprehensive tests

3. **After Making Changes**
   - Call `review_code` tool with complete information
   - Address all feedback from Quibbler
   - Run tests and verify functionality
   - Check bundle size impact

## Example Review Call

```javascript
review_code({
  user_instructions: "Add a new feature to track overtime hours for staff members",
  agent_plan: `
    Modified files:
    1. src/components/staff/StaffEditModal.jsx - Added overtime hours input field
    2. src/hooks/useWebSocketStaff.js - Added STAFF_OVERTIME_UPDATE message type
    3. go-server/main.go - Added overtime tracking in staff state

    Implementation details:
    - Added new "overtimeHours" field to staff data structure
    - Implemented WebSocket message handling for overtime updates
    - Created real-time synchronization for overtime changes
    - Added validation to ensure overtime hours are non-negative
    - Updated UI with Japanese labels for overtime tracking
  `,
  project_path: "/Users/kamalashidiq/Documents/Apps/shift-schedule-manager"
})
```

## Feedback Response

When Quibbler provides feedback:

1. **Review all suggestions carefully** - Consider security, performance, and architecture implications
2. **Implement necessary changes** - Address critical issues immediately
3. **Document decisions** - Explain why certain feedback might not apply
4. **Re-run tests** - Ensure changes don't break existing functionality
5. **Call review_code again** - If significant changes were made

## Additional Resources

- See CLAUDE.md for comprehensive development guidelines
- Check existing components for architectural patterns
- Review test files for testing standards
- Consult go-server/ directory for WebSocket protocol details
