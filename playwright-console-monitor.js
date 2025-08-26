/**
 * Real-time Console Monitor using Playwright
 * Captures console logs, errors, and performance data even when page becomes unresponsive
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class ConsoleMonitor {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.performance = [];
    this.startTime = Date.now();
    this.isMonitoring = false;
    this.browser = null;
    this.page = null;
  }

  async start() {
    console.log('🔍 Starting Playwright Console Monitor...');
    
    try {
      // Launch browser with debugging enabled
      this.browser = await chromium.launch({
        headless: false,
        devtools: false,
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--no-sandbox'
        ]
      });

      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });

      this.page = await context.newPage();
      
      // Set up console monitoring
      this.setupConsoleMonitoring();
      
      // Set up error monitoring
      this.setupErrorMonitoring();
      
      // Set up performance monitoring
      this.setupPerformanceMonitoring();
      
      // Navigate to the app
      console.log('🌐 Navigating to http://localhost:3000...');
      await this.page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      console.log('✅ Monitor ready! Waiting for AI assistant interaction...');
      console.log('📊 Real-time monitoring active');
      console.log('=' * 60);
      
      this.isMonitoring = true;
      
      // Set up periodic reporting
      this.startPeriodicReporting();
      
      // Wait for AI assistant button and set up click monitoring
      await this.setupAIAssistantMonitoring();
      
    } catch (error) {
      console.error('❌ Failed to start monitor:', error.message);
      await this.cleanup();
    }
  }

  setupConsoleMonitoring() {
    this.page.on('console', (msg) => {
      const timestamp = Date.now();
      const elapsed = timestamp - this.startTime;
      const logEntry = {
        timestamp: new Date(timestamp).toISOString(),
        elapsed,
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      };

      this.logs.push(logEntry);
      
      // Color-coded console output
      const colors = {
        error: '\x1b[31m',   // Red
        warning: '\x1b[33m', // Yellow
        info: '\x1b[36m',    // Cyan
        log: '\x1b[37m',     // White
        debug: '\x1b[90m'    // Gray
      };
      
      const color = colors[msg.type()] || '\x1b[37m';
      const timeStr = new Date().toISOString().substr(11, 12);
      
      console.log(`${color}[${timeStr}] ${msg.type().toUpperCase().padEnd(7)} ${msg.text()}\x1b[0m`);
      
      // Auto-export on critical errors
      if (msg.type() === 'error' && msg.text().includes('AI')) {
        this.exportReport('error-triggered');
      }
    });
  }

  setupErrorMonitoring() {
    // Page errors (uncaught exceptions)
    this.page.on('pageerror', (error) => {
      const timestamp = Date.now();
      const errorEntry = {
        timestamp: new Date(timestamp).toISOString(),
        elapsed: timestamp - this.startTime,
        type: 'uncaught_exception',
        message: error.message,
        stack: error.stack,
        name: error.name
      };
      
      this.errors.push(errorEntry);
      console.log(`\x1b[31m[${new Date().toISOString().substr(11, 12)}] UNCAUGHT ${error.message}\x1b[0m`);
      console.log(`\x1b[31mStack: ${error.stack}\x1b[0m`);
      
      this.exportReport('uncaught-error');
    });

    // Network request failures
    this.page.on('requestfailed', (request) => {
      const timestamp = Date.now();
      const networkError = {
        timestamp: new Date(timestamp).toISOString(),
        elapsed: timestamp - this.startTime,
        type: 'network_failure',
        url: request.url(),
        method: request.method(),
        error: request.failure()?.errorText
      };
      
      this.errors.push(networkError);
      console.log(`\x1b[31m[${new Date().toISOString().substr(11, 12)}] NET-FAIL ${request.url()} - ${request.failure()?.errorText}\x1b[0m`);
    });
  }

  setupPerformanceMonitoring() {
    // Monitor page metrics
    setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        const metrics = await this.page.evaluate(() => {
          const memory = performance.memory;
          const navigation = performance.getEntriesByType('navigation')[0];
          
          return {
            memory: memory ? {
              used: memory.usedJSHeapSize,
              total: memory.totalJSHeapSize,
              limit: memory.jsHeapSizeLimit
            } : null,
            timing: navigation ? {
              domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
              loadComplete: navigation.loadEventEnd - navigation.loadEventStart
            } : null,
            timestamp: Date.now()
          };
        });
        
        const perfEntry = {
          timestamp: new Date().toISOString(),
          elapsed: Date.now() - this.startTime,
          ...metrics
        };
        
        this.performance.push(perfEntry);
        
        // Alert on high memory usage
        if (metrics.memory && metrics.memory.used > 100 * 1024 * 1024) { // 100MB
          console.log(`\x1b[33m[MEMORY] High usage: ${Math.round(metrics.memory.used / 1024 / 1024)}MB\x1b[0m`);
        }
        
      } catch (error) {
        // Page might be unresponsive
        console.log(`\x1b[31m[PERF] Failed to get metrics - page may be unresponsive\x1b[0m`);
      }
    }, 5000); // Every 5 seconds
  }

  async setupAIAssistantMonitoring() {
    try {
      // Wait for AI assistant button to be available
      console.log('⏳ Waiting for AI assistant interface...');
      
      // Check for both main AI assistant and debug tester
      await this.page.waitForSelector('button:has-text("AI"), button:has-text("Start Debug Test")', {
        timeout: 10000
      });
      
      console.log('🤖 AI Assistant interface detected!');
      console.log('💡 Click the AI assistant button to start monitoring...');
      
      // Monitor for AI-related activity
      await this.page.exposeFunction('reportAIActivity', (activity) => {
        const timestamp = Date.now();
        console.log(`\x1b[36m[AI-ACTIVITY] ${activity}\x1b[0m`);
        
        this.logs.push({
          timestamp: new Date(timestamp).toISOString(),
          elapsed: timestamp - this.startTime,
          type: 'ai_activity',
          text: activity,
          source: 'playwright_monitor'
        });
      });
      
    } catch (error) {
      console.log('⚠️ AI assistant interface not found, monitoring all activity...');
    }
  }

  startPeriodicReporting() {
    setInterval(() => {
      if (!this.isMonitoring) return;
      
      const recentErrors = this.errors.filter(e => 
        Date.now() - new Date(e.timestamp).getTime() < 30000 // Last 30 seconds
      );
      
      if (recentErrors.length > 0) {
        console.log(`\x1b[33m📊 RECENT ACTIVITY: ${this.logs.length} logs, ${recentErrors.length} recent errors\x1b[0m`);
      }
    }, 10000); // Every 10 seconds
  }

  exportReport(reason = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `console-report-${reason}-${timestamp}.json`;
    
    const report = {
      exportReason: reason,
      exportTime: new Date().toISOString(),
      sessionDuration: Date.now() - this.startTime,
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        logsByType: this.logs.reduce((acc, log) => {
          acc[log.type] = (acc[log.type] || 0) + 1;
          return acc;
        }, {}),
        recentErrors: this.errors.filter(e => 
          Date.now() - new Date(e.timestamp).getTime() < 60000 // Last minute
        ).length
      },
      logs: this.logs,
      errors: this.errors,
      performance: this.performance.slice(-20), // Last 20 performance snapshots
      recommendations: this.generateRecommendations()
    };
    
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    
    console.log(`\x1b[32m📁 Report exported: ${filepath}\x1b[0m`);
    console.log(`\x1b[32m📊 Summary: ${report.summary.totalLogs} logs, ${report.summary.totalErrors} errors\x1b[0m`);
    
    return filepath;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Check for unresponsiveness patterns
    const recentLogs = this.logs.filter(l => 
      Date.now() - new Date(l.timestamp).getTime() < 30000
    );
    
    if (recentLogs.length === 0 && this.logs.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Possible page unresponsiveness',
        description: 'No recent console activity detected',
        solution: 'Page may be frozen - check for blocking operations'
      });
    }
    
    // Check for AI-related errors
    const aiErrors = this.errors.filter(e => 
      e.message && e.message.toLowerCase().includes('ai')
    );
    
    if (aiErrors.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'AI system errors detected',
        description: `Found ${aiErrors.length} AI-related errors`,
        solution: 'Review AI system initialization and processing'
      });
    }
    
    return recommendations;
  }

  async cleanup() {
    this.isMonitoring = false;
    if (this.browser) {
      await this.browser.close();
    }
    console.log('🧹 Cleanup complete');
  }
}

// Handle graceful shutdown
let monitor = null;

const cleanup = async () => {
  console.log('\n👋 Stopping console monitor...');
  if (monitor) {
    monitor.exportReport('shutdown');
    await monitor.cleanup();
  }
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start monitoring
const startMonitoring = async () => {
  monitor = new ConsoleMonitor();
  await monitor.start();
};

startMonitoring().catch(console.error);