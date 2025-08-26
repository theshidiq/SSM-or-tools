/**
 * Playwright AI Assistant Tester
 * Automatically triggers AI assistant and monitors console logs to diagnose 20% stuck issue
 */

const { chromium } = require('playwright');
const fs = require('fs');

class PlaywrightAITester {
  constructor() {
    this.logs = [];
    this.errors = [];
    this.startTime = Date.now();
    this.browser = null;
    this.page = null;
    this.lastProgressSeen = null;
    this.stuckDetected = false;
  }

  async start() {
    console.log('🤖 Starting Playwright AI Assistant Test...');
    
    try {
      // Launch browser
      this.browser = await chromium.launch({
        headless: false,
        devtools: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      });

      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 }
      });

      this.page = await context.newPage();
      
      // Set up monitoring
      this.setupMonitoring();
      
      // Navigate to app
      console.log('🌐 Loading app...');
      await this.page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      console.log('⏳ Waiting for AI system to initialize...');
      await this.page.waitForTimeout(5000);
      
      // Test AI assistant
      await this.testAIAssistant();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.exportLogs('test-failed');
    }
  }

  setupMonitoring() {
    // Console monitoring
    this.page.on('console', (msg) => {
      const timestamp = Date.now();
      const elapsed = timestamp - this.startTime;
      const logEntry = {
        timestamp: new Date(timestamp).toISOString(),
        elapsed,
        type: msg.type(),
        text: msg.text()
      };

      this.logs.push(logEntry);
      
      // Color output
      const colors = {
        error: '\x1b[31m',   // Red
        warning: '\x1b[33m', // Yellow
        info: '\x1b[36m',    // Cyan
        log: '\x1b[37m'      // White
      };
      
      const color = colors[msg.type()] || '\x1b[37m';
      const timeStr = new Date().toISOString().substr(11, 12);
      
      console.log(`${color}[${timeStr}] ${msg.type().toUpperCase().padEnd(7)} ${msg.text()}\x1b[0m`);
      
      // Check for progress updates
      if (msg.text().includes('Progress:') || msg.text().includes('⚡ Progress:')) {
        this.lastProgressSeen = {
          timestamp,
          progress: msg.text(),
          elapsed
        };
      }

      // Check for stuck indicators
      if (msg.text().includes('timeout') || msg.text().includes('unresponsive')) {
        this.stuckDetected = true;
        this.exportLogs('stuck-detected');
      }
    });

    // Error monitoring
    this.page.on('pageerror', (error) => {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        elapsed: Date.now() - this.startTime,
        type: 'uncaught_exception',
        message: error.message,
        stack: error.stack
      };
      
      this.errors.push(errorEntry);
      console.log(`\x1b[31m[ERROR] ${error.message}\x1b[0m`);
    });

    // Network failures
    this.page.on('requestfailed', (request) => {
      console.log(`\x1b[31m[NET-FAIL] ${request.url()}\x1b[0m`);
    });
  }

  async testAIAssistant() {
    console.log('🎯 Testing AI Assistant...');
    
    try {
      // Method 1: Look for AI assistant button
      console.log('🔍 Looking for AI assistant button...');
      
      const aiButton = await this.page.locator('button').filter({ hasText: 'AI' }).first();
      const debugButton = await this.page.locator('button').filter({ hasText: 'Start Debug Test' }).first();
      
      let targetButton = null;
      
      if (await aiButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        targetButton = aiButton;
        console.log('✅ Found main AI assistant button');
      } else if (await debugButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        targetButton = debugButton;
        console.log('✅ Found debug test button');
      } else {
        console.log('⚠️ No AI button found, looking for any button with AI text...');
        const anyAIButton = await this.page.locator('button:has-text("AI"), button:has-text("assistant"), button:has-text("Assistant")').first();
        if (await anyAIButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          targetButton = anyAIButton;
          console.log('✅ Found AI-related button');
        }
      }
      
      if (!targetButton) {
        console.log('❌ No AI button found. Available buttons:');
        const buttons = await this.page.locator('button').all();
        for (let i = 0; i < Math.min(buttons.length, 10); i++) {
          const text = await buttons[i].textContent().catch(() => '[no text]');
          console.log(`  - Button ${i}: "${text}"`);
        }
        throw new Error('AI assistant button not found');
      }

      // Click the AI button
      console.log('🖱️ Clicking AI assistant button...');
      await targetButton.click();
      
      console.log('📊 Monitoring AI processing...');
      
      // Monitor for progress and stuck conditions
      await this.monitorAIProgress();
      
    } catch (error) {
      console.error('❌ AI test failed:', error.message);
      this.exportLogs('ai-test-failed');
      throw error;
    }
  }

  async monitorAIProgress() {
    console.log('⏱️ Starting 60-second monitoring period...');
    
    const monitoringStart = Date.now();
    let lastLogCount = 0;
    let stuckWarningIssued = false;
    
    while (Date.now() - monitoringStart < 60000) { // 60 seconds
      await this.page.waitForTimeout(2000); // Check every 2 seconds
      
      const currentLogCount = this.logs.length;
      const elapsed = Date.now() - monitoringStart;
      
      // Check if logs are still coming
      if (currentLogCount === lastLogCount) {
        if (!stuckWarningIssued && elapsed > 10000) { // 10 seconds of no activity
          console.log(`⚠️ No new logs for 10+ seconds. Last progress: ${this.lastProgressSeen?.progress || 'none'}`);
          stuckWarningIssued = true;
        }
      } else {
        stuckWarningIssued = false; // Reset if we got new logs
      }
      
      lastLogCount = currentLogCount;
      
      console.log(`📊 Monitor: ${Math.round(elapsed/1000)}s elapsed, ${currentLogCount} logs, Last: ${this.lastProgressSeen?.progress || 'none'}`);
      
      // Check for completion
      const recentLogs = this.logs.slice(-10);
      const hasCompletionIndicator = recentLogs.some(log => 
        log.text.includes('completed') || 
        log.text.includes('success') || 
        log.text.includes('AI処理が正常に完了') ||
        log.text.includes('✅')
      );
      
      if (hasCompletionIndicator) {
        console.log('✅ AI processing appears to have completed');
        break;
      }
      
      // Check page responsiveness
      try {
        await this.page.evaluate(() => document.title);
      } catch (error) {
        console.log('❌ Page became unresponsive');
        this.stuckDetected = true;
        break;
      }
    }
    
    console.log('📋 Monitoring complete, exporting report...');
    this.exportLogs('monitoring-complete');
  }

  exportLogs(reason = 'manual') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ai-test-report-${reason}-${timestamp}.json`;
    
    const report = {
      testReason: reason,
      exportTime: new Date().toISOString(),
      testDuration: Date.now() - this.startTime,
      stuckDetected: this.stuckDetected,
      lastProgressSeen: this.lastProgressSeen,
      summary: {
        totalLogs: this.logs.length,
        totalErrors: this.errors.length,
        logsByType: this.logs.reduce((acc, log) => {
          acc[log.type] = (acc[log.type] || 0) + 1;
          return acc;
        }, {}),
      },
      analysis: this.analyzeStuckPoint(),
      logs: this.logs.slice(-200), // Last 200 logs to avoid size issues
      errors: this.errors,
      recommendations: this.generateRecommendations()
    };
    
    try {
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
      console.log(`\x1b[32m📁 Test report exported: ${filename}\x1b[0m`);
      
      // Also create a summary file
      const summaryFilename = `ai-test-summary-${timestamp}.txt`;
      const summary = this.generateSummary(report);
      fs.writeFileSync(summaryFilename, summary);
      console.log(`\x1b[32m📄 Summary exported: ${summaryFilename}\x1b[0m`);
      
      return filename;
    } catch (error) {
      console.error('❌ Failed to export report:', error.message);
      console.log('📊 Report summary:', {
        totalLogs: report.summary.totalLogs,
        stuckDetected: report.stuckDetected,
        lastProgress: report.lastProgressSeen?.progress
      });
    }
  }

  analyzeStuckPoint() {
    const progressLogs = this.logs.filter(log => 
      log.text.includes('Progress:') || 
      log.text.includes('⚡ Progress:') ||
      log.text.includes('%')
    );
    
    const featureGenLogs = this.logs.filter(log =>
      log.text.includes('🔧 Generating') ||
      log.text.includes('features for staff')
    );
    
    const timeoutLogs = this.logs.filter(log =>
      log.text.includes('timeout') ||
      log.text.includes('⏱️')
    );
    
    const lastProgress = progressLogs[progressLogs.length - 1];
    const lastFeature = featureGenLogs[featureGenLogs.length - 1];
    
    return {
      progressUpdates: progressLogs.length,
      lastProgress: lastProgress?.text,
      lastProgressTime: lastProgress?.elapsed,
      featureGenerationCount: featureGenLogs.length,
      lastFeatureGeneration: lastFeature?.text,
      lastFeatureTime: lastFeature?.elapsed,
      timeoutWarnings: timeoutLogs.length,
      stuckPoint: this.determineStuckPoint()
    };
  }

  determineStuckPoint() {
    const recentLogs = this.logs.slice(-50);
    
    // Check for specific stuck patterns
    if (recentLogs.some(log => log.text.includes('🔧 Generating') && 
        !recentLogs.slice(recentLogs.findIndex(l => l.text.includes('🔧 Generating')) + 1)
          .some(l => l.text.includes('✅ Generated')))) {
      return 'STUCK_IN_FEATURE_GENERATION';
    }
    
    if (recentLogs.some(log => log.text.includes('Progress: 2') || log.text.includes('Progress: 19'))) {
      return 'STUCK_AT_20_PERCENT';
    }
    
    if (recentLogs.some(log => log.text.includes('timeout'))) {
      return 'TIMEOUT_DETECTED';
    }
    
    return 'UNKNOWN_STUCK_POINT';
  }

  generateRecommendations() {
    const analysis = this.analyzeStuckPoint();
    const recommendations = [];
    
    if (analysis.stuckPoint === 'STUCK_IN_FEATURE_GENERATION') {
      recommendations.push({
        priority: 'CRITICAL',
        issue: 'Feature generation blocking main thread',
        solution: 'Move feature generation to Web Worker'
      });
    }
    
    if (analysis.stuckPoint === 'STUCK_AT_20_PERCENT') {
      recommendations.push({
        priority: 'HIGH',
        issue: '20% progress freeze detected',
        solution: 'Implement yielding mechanism for long-running operations'
      });
    }
    
    if (analysis.timeoutWarnings > 0) {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Timeout warnings detected',
        solution: 'Reduce processing time per operation or increase timeout limits'
      });
    }
    
    return recommendations;
  }

  generateSummary(report) {
    return `
AI ASSISTANT TEST SUMMARY
========================
Test Time: ${report.exportTime}
Duration: ${Math.round(report.testDuration / 1000)}s
Status: ${report.stuckDetected ? 'STUCK DETECTED' : 'COMPLETED'}

PROGRESS ANALYSIS:
- Last Progress: ${report.lastProgressSeen?.progress || 'None detected'}
- Progress Time: ${report.lastProgressSeen ? Math.round(report.lastProgressSeen.elapsed / 1000) + 's' : 'N/A'}
- Stuck Point: ${report.analysis.stuckPoint}

LOG SUMMARY:
- Total Logs: ${report.summary.totalLogs}
- Errors: ${report.summary.totalErrors}
- Progress Updates: ${report.analysis.progressUpdates}
- Feature Generations: ${report.analysis.featureGenerationCount}
- Timeout Warnings: ${report.analysis.timeoutWarnings}

RECOMMENDATIONS:
${report.recommendations.map(r => `- ${r.priority}: ${r.issue} → ${r.solution}`).join('\n')}

RECENT ACTIVITY:
${report.logs.slice(-10).map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.text}`).join('\n')}
    `.trim();
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the test
const runTest = async () => {
  const tester = new PlaywrightAITester();
  
  try {
    await tester.start();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await tester.cleanup();
  }
};

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n👋 Stopping test...');
  process.exit(0);
});

runTest().catch(console.error);