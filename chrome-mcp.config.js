// Chrome MCP Test Configuration
// Replaces playwright.config.ts with Chrome DevTools MCP integration

module.exports = {
  // Test Environment Configuration
  testEnvironment: {
    baseUrl: 'http://localhost:3000',
    wsUrl: 'ws://localhost:8080',
    timeout: 30000,
    retries: 2,
    headless: false // Chrome MCP runs with visible browser through Claude Code
  },

  // Chrome MCP Specific Settings
  chromeMCP: {
    // Browser viewport settings
    viewport: {
      width: 1280,
      height: 720
    },

    // Testing modes
    modes: {
      desktop: { width: 1280, height: 720 },
      tablet: { width: 768, height: 1024 },
      mobile: { width: 375, height: 667 }
    },

    // Screenshot settings
    screenshots: {
      onFailure: true,
      directory: './test-results/screenshots'
    },

    // Console monitoring
    console: {
      captureErrors: true,
      captureWarnings: true,
      captureInfo: false
    }
  },

  // Test Suites Configuration
  testSuites: {
    // Core application functionality
    core: {
      name: 'Core Application Tests',
      tests: [
        'application-loading',
        'navigation-functionality',
        'user-interface'
      ],
      timeout: 15000
    },

    // Staff management features
    staffManagement: {
      name: 'Staff Management Tests',
      tests: [
        'staff-create',
        'staff-edit',
        'staff-delete',
        'staff-list-display'
      ],
      timeout: 20000
    },

    // Real-time WebSocket functionality
    realtime: {
      name: 'Real-time Communication Tests',
      tests: [
        'websocket-connection',
        'realtime-updates',
        'conflict-resolution',
        'connection-recovery'
      ],
      timeout: 25000
    },

    // Japanese localization
    localization: {
      name: 'Japanese Localization Tests',
      tests: [
        'japanese-text-rendering',
        'date-formatting',
        'shift-symbols',
        'ui-labels'
      ],
      timeout: 10000
    },

    // Performance and load
    performance: {
      name: 'Performance Tests',
      tests: [
        'page-load-time',
        'websocket-latency',
        'ui-responsiveness',
        'memory-usage'
      ],
      timeout: 30000
    }
  },

  // Test Data Configuration
  testData: {
    // Sample staff members for testing
    sampleStaff: [
      {
        id: 'test-001',
        name: '田中太郎',
        position: 'シェフ',
        department: '調理場',
        type: 'regular'
      },
      {
        id: 'test-002',
        name: '佐藤花子',
        position: 'アシスタント',
        department: '調理場',
        type: 'part-time'
      }
    ],

    // Test schedule data
    sampleSchedule: {
      'test-001': {
        '2024-01-15': '○',
        '2024-01-16': '△',
        '2024-01-17': '×'
      }
    }
  },

  // Assertions and Validation
  assertions: {
    // Performance thresholds
    performance: {
      pageLoadTime: 3000, // 3 seconds max
      websocketLatency: 100, // 100ms max
      uiResponseTime: 50 // 50ms max
    },

    // Content validation
    content: {
      requiredElements: [
        '.schedule-table',
        '.staff-list',
        '.navigation-toolbar'
      ],
      japaneseText: [
        '調理場シフト表',
        '湖南荘',
        'スタッフ管理'
      ]
    },

    // Accessibility checks
    accessibility: {
      colorContrast: true,
      keyboardNavigation: true,
      screenReader: true
    }
  },

  // Reporting Configuration
  reporting: {
    format: 'json',
    outputDir: './test-results',
    screenshots: true,
    videos: false, // Chrome MCP doesn't support video recording

    // Test result aggregation
    aggregation: {
      byTestSuite: true,
      byBrowser: false, // Single browser (Chrome)
      byDevice: true
    }
  },

  // Integration with Test Strategy
  integration: {
    // Connect with run-all-tests.sh
    scriptIntegration: true,

    // KPI validation hooks
    kpiValidation: {
      enabled: true,
      thresholds: {
        raceConditionElimination: 100, // 100% target
        uiResponseTime: 50, // <50ms target
        realtimeSync: 100, // <100ms target
        systemStability: 99.9, // 99.9% target
        connectionStability: 99.9, // 99.9% target
        concurrentUsers: 1000 // 1000+ target
      }
    }
  },

  // Chrome MCP Specific Commands
  commands: {
    // Basic navigation
    navigate: 'mcp__chrome-devtools__navigate_page',
    snapshot: 'mcp__chrome-devtools__take_snapshot',
    click: 'mcp__chrome-devtools__click',

    // Form interactions
    fill: 'mcp__chrome-devtools__fill',
    fillForm: 'mcp__chrome-devtools__fill_form',

    // Advanced interactions
    hover: 'mcp__chrome-devtools__hover',
    drag: 'mcp__chrome-devtools__drag',

    // Monitoring
    console: 'mcp__chrome-devtools__list_console_messages',
    network: 'mcp__chrome-devtools__list_network_requests',

    // Screenshots and debugging
    screenshot: 'mcp__chrome-devtools__take_screenshot',
    evaluate: 'mcp__chrome-devtools__evaluate_script'
  }
};